#!/usr/bin/python
import sys
import subprocess
import os

lines = open('/boot/config.txt')
custom_file_portrait = False
custom_file_landscape = False
for line in lines:
	if 'framebuffer_width' in line:
		width = line.strip("framebuffer_width=")
		w = int(width)
	if 'framebuffer_height' in line:
		height = line.strip("framebuffer_height=")
		h = int(height)

custom_file_landscape_path = '/home/pi/media/brand_intro.mp4'
if os.path.exists(custom_file_landscape_path):
	custom_file_landscape = True

custom_file_portrait_path = '/home/pi/media/brand_intro_portrait.mp4'
if os.path.exists(custom_file_portrait_path):
	custom_file_portrait = True


if w < h : 
	if custom_file_portrait :
		path = custom_file_portrait_path
	elif custom_file_landscape :
		path = custom_file_landscape_path
	else:
		path = custom_file_landscape_path
else:
	if custom_file_landscape :
		path = custom_file_landscape_path
	else:
		path = custom_file_landscape_path


a = subprocess.call(["omxplayer", path])
#a = subprocess.call(["omxplayer","--loop","--no-osd","-o", "hdmi", path])
