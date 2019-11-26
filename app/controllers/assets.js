'use strict';

var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    util = require('util'),
    _ = require('lodash'),
    fileUtil = require('../others/file-util');

var mongoose = require('mongoose'),
    Asset = mongoose.model('Asset'),
    config = require('../../config/config'),
    rest = require('../others/restware');

exports.index = function (req, res) {

    var files = [],
        dbdata;
    async.series([
        function(next) {
            fs.readdir(config.mediaDir, function (err, data) {
                if (err) {
                    next("Erro ao ler diretório da mídia: " + err)
                } else {
                    files = data.filter(function (file) {
                        return (file.charAt(0) != '_' && file.charAt(0) != '.');
                    });
                    if (files.length)
                        files.sort(function(str1,str2){return (str1.localeCompare(str2,undefined,{numeric:true}));});
                    next();
                }
            })
        },
        function(next)  {
            Asset.find({}, function (err, data) {
                if (err) {
                    util.log("Erro ao ler Coleção de Conteúdos: "+err);
                } else {
                    dbdata = data;
                }
                next();
            })
        }
    ], function(err) {
        if (err)
            rest.sendError(res,err);
        else
            rest.sendSuccess(res, "Enviando arquivos do diretório de mídia: ",
                {files: files, dbdata: dbdata, systemAssets: config.systemAssets})

    });
}


exports.createFiles = function (req, res) {

    var files = [],
        data = [];

    if (req.files)
        files = req.files["assets"]
    else
        return rest.sendError(res, "Não há arquivos a serem enviados");

    async.each(files, renameFile, function (err) {
        if (err) {
            var msg = "Erro ao renomear arquivo após envio: "+err;
            util.log(msg);
            return rest.sendError(res, msg);
        } else {
            return rest.sendSuccess(res, ' Arquivos enviados com sucesso', data);
        }
    })

    function renameFile(fileObj, next) {
        console.log("Arquivo enviado: "+fileObj.path);
        var filename = fileObj.originalname.replace(config.filenameRegex, '');

        if ((filename).match(config.zipfileRegex)) //unzip won't work with spcaces in file name
            filename = filename.replace(/ /g,'')

        if(filename.match(config.brandRegex)) // change brand video name
            filename = filename.toLowerCase();

        fs.rename(fileObj.path, path.join(config.mediaDir, filename), function (err) {
            if (err) {
                next(err);
            } else {
                if((filename).match(/^custom_layout.*html$/i)){
                    fileUtil.modifyHTML(config.mediaDir,filename)
                }
                data.push({
                    name: filename,
                    size: fileObj.size,
                    type: fileObj.mimetype
                });
                next();
            }
        });
    }

}

exports.updateFileDetails = function (req, res) {
    require('./server-assets').storeDetails(req, res);
}

exports.getFileDetails = function (req, res) {
    var file = req.params['file'],
        fileData,
        dbData;

    async.series([
        function(next) {
            fs.stat(path.join(config.mediaDir, file), function (err, data) {
                if (err) {
                    next('Os detalhes do arquivo não puderam ser lidos: '+ err);
                } else {
                    fileData = data;
                    if (file.match(config.imageRegex))
                        fileData.type = 'image';
                    else if (file.match(config.videoRegex))
                        fileData.type = 'video';
                    else if (file.match(config.audioRegex))
                        fileData.type = 'audio';
                    else if (file.match(config.htmlRegex))
                        fileData.type = 'html';
                    else if (file.match(config.liveStreamRegex)
                                || file.match(config.omxStreamRegex)
                                || file.match(config.mediaRss)
                                || file.match(config.CORSLink)
                                || file.match(config.linkUrlRegex)
                    )
                        fileData.type = 'link';
                    else if (file.match(config.gcalRegex))
                        fileData.type = 'gcal';
                    else if (file.match(config.pdffileRegex))
                        fileData.type = 'pdf';
                    else if (file.match(config.txtFileRegex))
                        fileData.type = 'text';
                    else if (file.match(config.radioFileRegex))
                        fileData.type = 'radio'
                    else
                        fileData.type = 'other';
                    next();
                }
            })
        },
        function(next) {
            Asset.findOne({name: file}, function (err, data) {
                if (err) {
                    util.log("Erro ao ler Coleção de recursos: " + err);
                } else {
                    dbData = data;
                }
                next();
            })
        }
    ],function(err){
        if (err)
            rest.sendError(res,err);
        else
            rest.sendSuccess(res, 'Enviando detalhes do arquivo',
                    {
                        name: file,
                        size: ~~(fileData.size / 1000) + ' KB',
                        ctime: fileData.ctime,
                        path: '/media/' +  file,
                        type: fileData.type,
                        dbdata: dbData
                    });
    })
}

exports.deleteFile = function (req, res) {

    var file = req.params['file'],
        ext = path.extname(file);

    async.series([
        function(next) {
            fs.unlink(path.join(config.mediaDir, file), function (err) {
                if (err)
                    next("O arquivo não pôde ser removido  " + file + ';' + err)
                else
                    next()
            })
        },
        function(next) {
            Asset.remove({name: file}, function (err) {
                if (err)
                    util.log('o sistema não pôde ler o arquivo do banco de dados,' + file)
                next();
            })
        },
        function(next) {
            var thumbnailPath = path.join(config.thumbnailDir, file);
            if (file.match(config.videoRegex))
                thumbnailPath += '.png';
            if(file.match(config.videoRegex) || file.match(config.imageRegex)){
                fs.unlink(thumbnailPath, function (err) {
                    if (err)
                        util.log('incapaz de encontrar/remover miniatura: ' + err)
                    next();
                })
            } else {
                next()
            }
        }
    ], function(err) {
        if (err)
            rest.sendError(res,err);
        else
            return rest.sendSuccess(res, 'Arquivo removido com sucesso', file);
    })
}

exports.updateAsset = function (req, res) {

    if (req.body.newname) {
        var oldName = req.params['file'],
            newName = req.body.newname;

        async.series([
            function(next) {
                fs.rename(path.join(config.mediaDir, oldName), path.join(config.mediaDir, newName), function (err) {
                    if (err) {
                        next('Erro ao tentar renomear arquivo: '+ err);
                    } else {
                        next();
                    }
                });
            },
            function(next) {
                Asset.findOne({name: oldName}, function(err, asset){
                    if (err || !asset) {
                        util.log('não foi possível encontrar o recurso no banco de dados,' + oldName)
                        return next();
                    }
                    asset.name = newName;
                    asset.save(function(err) {
                        if (err)
                            util.log('não foi possível salvar o recurso após renomear,' + oldName)
                        next();
                    });
                });
            }
        ], function(err) {
            if (err)
                rest.sendError(res,err);
            else
                return rest.sendSuccess(res, 'Arquivo renomeado para', newName);
        })
    } else if (req.body.dbdata) {
        Asset.load(req.body.dbdata._id, function (err, asset) {
            if (err || !asset) {
                return rest.sendError(res, 'Erro ao salvar categorias', err);
            } else {
                asset = _.extend(asset, req.body.dbdata);
                asset.save(function (err, data) {
                    if (err)
                        return rest.sendError(res, 'Erro ao salvar categorias', err);

                    return rest.sendSuccess(res, 'Categorias salvas', data);
                });
            }
        })
    }
}

exports.getCalendar = function (req, res) {
    var calFile = path.join(config.mediaDir, req.params['file']);

    fs.readFile(calFile, 'utf8', function (err, data) {
        if (err || !data)
            return rest.sendError(res, 'erro de leitura de arquivo Gcal', err);

        var calData = JSON.parse(data);
        require('./gcal').index(calData, function (err, list) {
            if (err) {
                return rest.sendError(res, 'Gcal erro', err);
            } else {
                return rest.sendSuccess(res, 'Enviando detalhes do calendário',
                    {
                        profile: calData.profile,
                        list: _.map(list.items, function (item) {
                            return _.pick(item, 'summary', 'id')
                        }),
                        selected: _.find(list.items, {'id': calData.selectedEmail}).summary
                    }
                );
            }
        })
    });
}

exports.createAssetFileFromContent = function (name, data, cb) {
    var file = path.resolve(config.mediaDir, name);
    fs.writeFile(file, JSON.stringify(data, null, 4), cb);
}

exports.updateCalendar = function (req, res) {
    var calFile = path.join(config.mediaDir,  req.params['file']);

    fs.readFile(calFile, 'utf8', function (err, data) {
        if (err || !data)
            return rest.sendError(res, 'Erro de leitura de arquivo Gcal', err);
        data = JSON.parse(data);
        data.selectedEmail = req.body['email'];
        exports.createAssetFileFromContent(calFile, data, function () {
            if (err)
                return rest.sendError(res, 'Erro ao escrever no arquivo Gcal', err);
            else
                return rest.sendSuccess(res, 'E-mail atualizado com sucesso');
        });
    });
}

exports.createLinkFile = function (req, res) {
    var details = req.body.details;

    async.series([
        function (next) {
            fs.writeFile(config.mediaPath + details.name + details.type, JSON.stringify(details, null, 4), 'utf8', function (err) {
                next(err);
            })
        },function(next) {
                require('./server-assets').storeLinkDetails(details.name+details.type,
                    'link',
                    req.body.categories,
                    next
                );
        }], function(err) {
                if (err)
                    return rest.sendError(res, 'erro ao criar arquivo de link', err);
                else
                    return rest.sendSuccess(res, 'Arquivo de link criado para o link como ' + details.name + details.type);
        })
}

exports.getLinkFileDetails = function (req, res) {
    var fileToRead = req.params['file'];

    var retData = {}

    async.series([
        function (next) {
            fs.readFile(config.mediaPath + fileToRead, 'utf-8', function (err, data) {
                retData.data = data
                next(err)
            })
        }, function (next) {
            Asset.findOne({name: fileToRead}, function (err, dbdata) {
                retData.dbdata = dbdata
                next()
            })
    }], function (err) {
        if (err) {
            return rest.sendError(res, 'Não foi possível ler o arquivo de link, error:' + err);
        } else {
            return rest.sendSuccess(res, 'detalhes do arquivo de link', retData);
        }
    })
}

exports.updatePlaylist = function (req,res) {
    //req.body contain playlist name and assets, for deleted playlist send playlist name and empty assets
    require('./server-assets').updatePlaylist(req.body.playlist, req.body.assets);
    return rest.sendSuccess(res, 'a atualização do recurso foi agendada');
}
