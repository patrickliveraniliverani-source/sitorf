import re

with open('/Volumes/Extreme Pro/SITI INTERNET/SITO_RF/green-vision.html', 'r', encoding='utf-8') as f:
    content = f.read()

new_footer = """    <!-- FOOTER -->
    <footer class="site-footer">
        <div class="container">
            <div class="footer-grid">
                <div class="footer-brand">
                    <div class="footer-logo">
                        <img src="img/logo.png" alt="R.F. Resina Forlivese" class="logo-img" style="height: 60px;">
                    </div>
                    <p class="tagline">Gli esperti delle imbottiture in poliuretano dal 1973.</p>
                </div>
                <div class="footer-col">
                    <h4>Link Rapidi</h4>
                    <ul>
                        <li><a href="chi-siamo.html">Chi Siamo</a></li>
                        <li><a href="settori.html">Settori</a></li>
                        <li><a href="prodotti.html">Prodotti</a></li>
                        <li><a href="lavorazioni.html">Lavorazioni</a></li>
                        <li><a href="qualita.html">Qualit\u00e0</a></li>
                        <li><a href="green-vision.html">Green Vision</a></li>
                        <li><a href="contatti.html">Contatti</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Contatti</h4>
                    <ul>
                        <li>0543 700047</li>
                        <li style="margin-top:8px;">rf@resinaforlivese.it</li>
                        <li style="margin-top:8px;">resinaforlivese@pec.it</li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Certificazioni</h4>
                    <div class="footer-badges">
                        <span class="footer-badge">ISO 9001</span>
                        <span class="footer-badge">Parit\u00e0 Genere</span>
                        <img src="img/italia-imbottiti.png" alt="Italia Imbottiti"
                            style="height:30px; opacity:0.8; background:#fff; padding:2px; border-radius:4px;">
                    </div>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <div class="container">
                <div class="footer-bottom-row">
                    <p>\u00a9 2025 R.F. Resina Forlivese S.r.l. \u2014 Tutti i diritti riservati</p>
                    <div style="display:flex;gap:16px;"><a href="#">Privacy Policy</a><a href="#">Cookie Policy</a></div>
                </div>
            </div>
        </div>
    </footer>"""

footer_pattern = r'    <!-- FOOTER -->.*?</footer>'
new_content = re.sub(footer_pattern, new_footer, content, flags=re.DOTALL)

if new_content == content:
    print('ERROR: No replacement made - pattern not found')
else:
    with open('/Volumes/Extreme Pro/SITI INTERNET/SITO_RF/green-vision.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('SUCCESS: Footer replaced in green-vision.html')
