#!/bin/bash

version=$(grep '"version":' manifest.json | cut -d: -f2 | cut -d\" -f2)

rm -rf SHA256SUMS package
rm -rf ._*
rm -rf .tgz
rm -rf *.pyc
rm -rf photos
mkdir photos

mkdir package
mkdir package/photos
cp *.py manifest.json LICENSE README.md package/
cp -r pkg css images js views package/
cd package
find . -type f \! -name SHA256SUMS -exec sha256sum {} \; >> SHA256SUMS
cd ..

tar czf "photo-frame-${version}.tgz" package
sha256sum "photo-frame-${version}.tgz"
