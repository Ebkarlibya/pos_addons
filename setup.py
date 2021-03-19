# -*- coding: utf-8 -*-
from setuptools import setup, find_packages

with open('requirements.txt') as f:
	install_requires = f.read().strip().split('\n')

# get version from __version__ variable in pos_addons/__init__.py
from pos_addons import __version__ as version

setup(
	name='pos_addons',
	version=version,
	description='Pos addons general',
	author='Ebkar',
	author_email='admin@ebkar.ly',
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
