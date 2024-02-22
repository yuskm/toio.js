## note
### build
- packages/cube もしくは packages/scanner を編集した場合は build が必要。
- typescript 3.7.5 で yarn build すると、packages/cube の build 時に 以下のようなエラーが発生する。
```
../../node_modules/@types/readable-stream/index.d.ts(4,13): error TS1005: '=' expected.
../../node_modules/@types/readable-stream/index.d.ts(4,18): error TS1005: ';' expected.
../../node_modules/@types/readable-stream/index.d.ts(4,29): error TS1005: ';' expected.
../../node_modules/@types/readable-stream/index.d.ts(4,34): error TS1005: ';' expected.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
```
- これは　MQTT.js に依存する @types/readable-stream v4.0.5 は typescript 3.7.5 非対応のようである。
- 暫定対策として、 node_modules/@types/readable-stream/index.d.ts を v4.0.4 相当に差し替えれば、build は通る。
- v 4.0. の index.d.ts を examples/turn-table/node_modules_@types_readable-stream_index.d.ts に commit しておく。
