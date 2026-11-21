# E-maily zákaznických účtů Kurtna.cz

Projekt Supabase: `www.kurtna.cz` (`ieevcrhfiwdmpayfnerh`).

1. V Authentication → URL Configuration nastavte Site URL a povolenou adresu návratu na `https://kurtna.cz/ucet/`.
2. V Authentication → Email nastavte vlastní SMTP a povolte potvrzování e-mailů. Pro Resend použijte `smtp.resend.com`, port `465`, uživatele `resend` a API klíč jako heslo. Odesílatel musí být z ověřené domény. Přihlašovací údaje uložte výhradně v Supabase. V Resend vypněte sledování kliknutí pro ověřovací odkazy.
3. Do šablony Confirm sign up vložte [confirmation.html](confirmation.html) s předmětem **Potvrďte registraci na Kurtna.cz**.
4. Do šablony Reset password vložte [recovery.html](recovery.html) s předmětem **Nastavení nového hesla na Kurtna.cz**.
5. Ověřte registraci a obnovu hesla s kontrolovanou schránkou mimo tým Supabase. Odkaz má otevřít `/ucet/`.

Šablony používají `{{ .ConfirmationURL }}`, které vyplní Supabase. Změny souborů v repozitáři samy nemění nastavení Supabase.
