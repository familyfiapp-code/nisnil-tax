# Nisnil Income Tax – go-live steps (tax.nisnil.co.in)

Total time: about 30 minutes. Do every step signed in as **familyfi.app@gmail.com**.

## 1. Server (Google Apps Script) – 10 min
1. Open https://script.google.com → **New project** → rename it `Nisnil Income Tax Server`.
2. Delete the sample code, paste everything from `server/Code.gs`, click **Save**.
3. Choose `setup` in the function list → **Run** → **Review permissions** → allow (Drive + external requests).
   This creates the Drive folder **Nisnil Tax** with the data file.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me (familyfi.app@gmail.com)**
   - Who has access: **Anyone**
   → **Deploy** → copy the **Web app URL** (ends with `/exec`).
5. Open `config.js` and paste that URL between the quotes of `TAX_API`.

When you change `Code.gs` later: **Deploy → Manage deployments → Edit → Version: New version → Deploy**. The URL stays the same.

## 2. Website files on GitHub Pages – 10 min
1. GitHub → account **familyfiapp-code** → **New repository** → name `nisnil-tax`.
   Public is fine: the code has no secrets and no client data. All data stays in your Drive.
2. **Add file → Upload files** → upload `index.html`, `config.js` (with TAX_API filled), `CNAME`, `.nojekyll`, `robots.txt`.
   Do not upload the `server` folder.
3. Repository **Settings → Pages** → Source: **Deploy from a branch** → `main` / `(root)` → Save.
   Custom domain: `tax.nisnil.co.in` → Save → tick **Enforce HTTPS** once it is offered.

## 3. Domain – 5 min
At your domain registrar (where nisnil.co.in is managed) add one DNS record:

| Type  | Name / Host | Value                       |
|-------|-------------|-----------------------------|
| CNAME | tax         | familyfiapp-code.github.io  |

HTTPS can take up to an hour after DNS starts working.

## 4. Google sign-in – 3 min
Google Cloud Console → **APIs & Services → Credentials** → open the OAuth client used by FamilyFi
(`936218734453-udv7…`) → **Authorized JavaScript origins** → **Add URI** → `https://tax.nisnil.co.in` → Save.
Check **OAuth consent screen** shows **In production** (in "Testing", only listed test users can sign in).

## 5. nisnil.co.in link – 2 min
Replace `index.html` in the `nisnil-site` repository with the updated one (adds **File ITR · Login** in the menu
and turns the Taxation service card into **Available now** with a **File your ITR · Login** button).

## 6. Master console – 1 min
console.nisnil.co.in → **Apps → Add a new app**
- App name: `Income Tax` · Type: **Payments only** · App link: `https://tax.nisnil.co.in/`
- Prices: `1499, 2999, 3499, 5999` · Word in Razorpay page name: `ITR`

## 7. First sign-in (owner) – 5 min
Open https://tax.nisnil.co.in → **Sign in with Google** as familyfi.app@gmail.com, then:
1. **Settings & backup**: check fees and assessment year.
2. **Client logins**: set the vault passphrase (min 10 characters). Share it only with your employee. If it is lost, saved passwords cannot be recovered.
3. **Payment QR & UPI**: upload your UPI QR and UPI ID.
4. **Team access**: add each employee's Gmail. They sign in at the same address and see only the Income Tax work.

## 8. Test before announcing
File one real return end to end (your own or a family member's) and check:
customer sign-in → upload → details → computation → approve → pay → owner verifies → file → ITR-V delivered.

## Where things live
- Data: Google Drive › **Nisnil Tax** › `nisnil-tax-data.json`, with a daily copy in **Backups**.
- Documents: Drive › Nisnil Tax › *AY* › *Client name (id)* › `01_Docs` and `04_Filed`.
- Portal passwords are encrypted in the browser with the vault passphrase; the server only stores the encrypted text.

## Known limits (current version)
- **Generate JSON** makes a draft data file, not the official upload format. Map the official schema before uploading JSON to the portal (send the ITR schema file and one masked prefill JSON).
- Interest u/s 234A/B/C and surcharge marginal relief are not calculated – add manually when they apply.
- Razorpay link payments are confirmed by the owner (no webhook yet).
- Files up to 10 MB each.
