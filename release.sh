#!/bin/bash

git status -s

if [[ $(git status -s) ]]; then
    read -p "Enter commit message (Ctrl+C to abort): " COMMIT_MESSAGE
    git add -A
    git commit -m "$COMMIT_MESSAGE"
    npm version minor
else
    echo "Nothing to commit"
fi

VERSION=$(grep "version" manifest.json | grep -o '"version": "[^"]*' | cut -d'"' -f4)
echo "Creating tag $VERSION"
git tag -a $VERSION -m "$VERSION"
git push origin $VERSION
