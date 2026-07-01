# PR前セルフチェック

`superpowers:finishing-a-development-branch` で実施する。

- 同一メソッド/関数が複数ファイルに重複していないか（DRY）
- 全ファイルが200行以内か
- CSS/スタイルにハードコード値がないか
- POSTで新規作成するエンドポイントは201を返しているか
- 設定ファイルに未使用コメント/dead codeがないか
- async関数をonClickに直接渡していないか
- 設計判断のADR・学習ノートに記録漏れがないか
