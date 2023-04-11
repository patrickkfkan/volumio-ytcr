cat >dist/package.json <<!EOF
{
  "type": "commonjs"
}
!EOF

cp ./UIConfig.json ./dist/
mkdir -p ./dist/i18n
cp -a ./src/i18n/* ./dist/i18n/