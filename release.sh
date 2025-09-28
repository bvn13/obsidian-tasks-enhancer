#!/bin/bash

VERSION=$(grep "version" manifest.json | grep -o '"version": "[^"]*' | cut -d'"' -f4)

git tag -a $VERSION -m "$VERSION"
git push origin $VERSION
