# Deploy Gate Checklist

本番 deploy 前に、変更内容・安全性・公開範囲・rollback 可否を確認するためのチェックシート。  
目的は「その場のノリで deploy しないこと」と「危ない変更を止めること」。

---

## Rule

判定は次の3つだけ。

- **Go**: 出してよい
- **Go with risk**: 限定条件つきで出す
- **No-Go**: 出さない

---

## 1. Change Summary

### 今回の変更
- 機能追加:
- 修正内容:
- 影響範囲:
- 本番で何が変わるか一言で:

### Gate
- [ ] 変更内容が一言で説明できる
- [ ] 影響範囲が説明できる

**どちらかが曖昧なら `No-Go`**

---

## 2. Core Product Checks

### 本番で最低限動くべきもの
- [ ] analyze listing が通る
- [ ] review comparison が表示される
- [ ] weekly report が表示される
- [ ] PDF export が壊れていない
- [ ] mobile で致命的な崩れがない

### Gate
- 主要フロー未確認 or NG がある → **`No-Go`**
- 軽微な崩れのみで回避可能 → **`Go with risk`**

---

## 3. Saved Listings / Data Exposure Checks

### saved listings / deep link
- [ ] Save Current Listing が通る
- [ ] Load Saved Listings が通る
- [ ] Open Latest Report が通る
- [ ] `/?saved=<id>` の deep link が通る
- [ ] 他人データが見えない前提を確認している
- [ ] saved id が推測されにくい
- [ ] deep link の公開範囲を説明できる

### Gate
- 他人データ閲覧の可能性がある → **`No-Go`**
- id 推測耐性が弱い / 公開範囲が曖昧 → **`No-Go`**

---

## 4. Secrets / Auth Checks

### 危険サイン確認
- [ ] secret を URL query に載せていない
- [ ] 副作用のある endpoint を GET で叩いていない
- [ ] token / key を README・Issue・Chat に貼る前提になっていない
- [ ] 本物の secret を repo に入れていない
- [ ] env の必須 / 任意が整理されている
- [ ] 認証方法を一言で説明できる

### Gate
次のどれか1つでもあれば **`No-Go`**
- secret が URL にある
- 認証方式が雑
- 本物の secret が repo にある
- 必須 env が曖昧

---

## 5. Env / Production Config Checks

- [ ] 必須 env が揃っている
- [ ] preview と production の env が混ざっていない
- [ ] `APP_BASE_URL` が本番 URL を指している
- [ ] mail 設定が本番用として妥当（email が今回対象なら）
- [ ] Cloudflare / deploy 先の env が最新
- [ ] 本番 URL と preview URL の使い分けを説明できる

### Gate
- 通知 / email / deep link に関わる env が曖昧 → **`No-Go`**
- email が今回対象外なら mail 関連項目は `N/A`
- 軽微な環境差分のみ → **`Go with risk`**

---

## 6. Notification / dryRun Checks

If notification / email is out of scope for this release, mark this whole section as `N/A`.

- [ ] dryRun が 200 で返る
- [ ] 返却内容の中身を確認している
- [ ] `errors` / `skipped` / `waitingForHistory` / `emailSkipped` を確認している
- [ ] 実送信前にテスト宛先で確認する段取りがある
- [ ] 「200だったからOK」で終わっていない

### Gate
- dryRun が未確認 → **`No-Go`**
- 200 だけ見て中身未確認 → **`No-Go`**
- notification / email が今回のリリース対象外なら `N/A`

---

## 7. Failure Mode Checks

### 異常系を最低限説明できるか
- [ ] API失敗時の挙動を説明できる
- [ ] env不足時の挙動を説明できる
- [ ] save失敗時の挙動を説明できる
- [ ] email未設定時の挙動を説明できる（email が今回対象なら）
- [ ] UIが真っ白にならないことを確認している

### Gate
- 異常系が全く説明できない → **`Go with risk` まで**
- データ / 通知 / auth に絡む異常系が不明 → **`No-Go`**

---

## 8. Rollback Checks

- [ ] rollback 先 commit が明確
- [ ] rollback 手順が説明できる
- [ ] deploy 後の確認手順がある
- [ ] 問題時の停止方法が分かる
- [ ] secret 漏洩時のローテ方法が分かる

### Gate
- rollback 先不明 → **`No-Go`**
- 戻し方が曖昧 → **`No-Go`**

---

## 9. Post-Deploy Checks

### deploy 直後にやること
- [ ] 本番 URL を開く
- [ ] 1件分析する
- [ ] saved listings を読み込む
- [ ] deep link を開く
- [ ] `npm run smoke` で core flow smoke check を通す
- [ ] Issues / logs / errors を確認する
- [ ] 実施担当者が決まっている

### Gate
- 実施担当者未定 → **`Go with risk` まで**
- 直後確認なし → **`No-Go`**

---

## 10. Final Decision

### Go
次をすべて満たす
- 主要フローOK
- secret / auth に危険サインなし
- saved listings / deep link の公開範囲OK
- dryRun の中身確認済み、または notification が今回対象外
- rollback 明確

### Go with risk
- product は通る
- 重大な security / data leak 懸念はない
- ただし email 実送信未確認、異常系薄い、監視薄いなど不安が残る

### No-Go
次のどれか1つでもあれば止める
- secret が URL にある
- 他人データが見える可能性がある
- rollback 不明
- 必須 env 不明
- dryRun の中身未確認（notification が今回対象なら）
- 主要フロー未確認
- 「たぶん大丈夫」で押そうとしている

---

## Fast Gate Version

時間がない時はこの6個だけ見る。

- [ ] 何が変わるか一言で説明できるか
- [ ] 主要機能は通ったか
- [ ] secret の扱いは雑じゃないか
- [ ] 他人データが見える可能性はないか
- [ ] rollback できるか
- [ ] 不明点を「たぶん」で流していないか

**1つでも怪しければ `No-Go` 寄りで判断する**

---

## Submission Template for PM / Reviewer

```md
## Change Summary
- What changes:
- Scope:

## Risks
- What may break:
- Impact on data / auth / secrets:

## Check Results
- Core product: OK / NG
- Saved listings / deep link: OK / NG
- dryRun: OK / NG
- Rollback: OK / NG

## Decision Proposal
- Go / Go with risk / No-Go
- Reason:
```
