#!/usr/bin/env python3
import os
import sys
import subprocess

# Ensure beautifulsoup4 is installed
try:
    from bs4 import BeautifulSoup, Comment
except ImportError:
    print("BeautifulSoup4 not found. Installing it now...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "beautifulsoup4"])
        from bs4 import BeautifulSoup, Comment
        print("BeautifulSoup4 installed successfully!")
    except Exception as e:
        print(f"Error installing BeautifulSoup4: {e}")
        print("Please install beautifulsoup4 manually via: pip install beautifulsoup4")
        sys.exit(1)

def clean_text(text):
    if not text:
        return ""
    # Clean whitespace and strip
    lines = [line.strip() for line in text.strip().splitlines()]
    # Remove empty lines
    lines = [line for line in lines if line]
    return " ".join(lines)

def extract_products_js_data(html_content):
    import re
    match = re.search(r'const\s+materialsData\s*=\s*(\{.*?\});', html_content, re.DOTALL)
    if not match:
        return []
        
    js_content = match.group(1)
    keys = ['poliuretani', 'ovatte', 'piuma', 'microfibra', 'memory']
    extracted_products = []
    
    for key in keys:
        key_pattern = rf"'{key}'\s*:\s*\{{(.*?)\}}"
        key_match = re.search(key_pattern, js_content, re.DOTALL)
        if not key_match:
            key_pattern = rf"{key}\s*:\s*\{{(.*?)\}}"
            key_match = re.search(key_pattern, js_content, re.DOTALL)
            
        if not key_match:
            continue
            
        block = key_match.group(1)
        
        def get_field(name, text_block):
            # Try double quotes first (supporting escaped quotes)
            m = re.search(rf'{name}\s*:\s*"((?:[^"\\]|\\.)*)"', text_block, re.DOTALL)
            if m:
                return m.group(1).replace(r'\"', '"').replace(r'\\', '\\')
            # Try single quotes
            m = re.search(rf'{name}\s*:\s*\'((?:[^\'\\]|\\.)*)\'', text_block, re.DOTALL)
            if m:
                return m.group(1).replace(r"\'", "'").replace(r'\\', '\\')
            return ""
            
        title = get_field('title', block)
        subtitle = get_field('subtitle', block)
        description = get_field('description', block)
        description = re.sub(r'<[^>]+>', '', description).strip()
        
        specs_block_m = re.search(r'specs\s*:\s*\[(.*?)\]', block, re.DOTALL)
        specs = []
        if specs_block_m:
            # Find all double-quoted items (supporting escaped quotes)
            double_quotes = re.findall(r'"((?:[^"\\]|\\.)*)"', specs_block_m.group(1))
            # Find all single-quoted items
            single_quotes = re.findall(r"'((?:[^'\\]|\\.)*)'", specs_block_m.group(1))
            
            # Select whichever match succeeded/found more items
            items = double_quotes if len(double_quotes) >= len(single_quotes) else single_quotes
            
            for item in items:
                # Unescape quotes
                clean_item = item.replace(r'\"', '"').replace(r"\'", "'").replace(r'\\', '\\')
                # Clean HTML tags
                clean_item = re.sub(r'<[^>]+>', '', clean_item).strip()
                if clean_item:
                    specs.append(f"  • {clean_item}")
                    
        formatted_product = f"■ {title}"
        if subtitle:
            formatted_product += f" ({subtitle})"
        if description:
            formatted_product += f"\n  {description}"
        if specs:
            formatted_product += f"\n  Specifiche:\n" + "\n".join(specs)
            
        extracted_products.append(formatted_product)
        
    return extracted_products

def extract_texts_from_html(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, "html.parser")
    
    # Page info
    page_filename = os.path.basename(file_path)
    page_title = soup.title.string.strip() if soup.title else "Senza Titolo"
    
    # Extract dynamic product data for prodotti.html before decomposing scripts
    dynamic_products = []
    if page_filename == "prodotti.html":
        try:
            dynamic_products = extract_products_js_data(html_content)
        except Exception as e:
            print(f"Errore nell'estrazione dei dati JS per prodotti.html: {e}")
    
    # Remove header, footer, script, style, comments, and navigations
    for element in soup(["script", "style", "header", "footer"]):
        element.decompose()
        
    # Remove common navigation elements or widgets by class/id
    selectors_to_remove = [
        ".site-header", ".site-footer", ".mobile-nav", ".mobile-menu",
        ".floating-whatsapp", ".scroll-top-btn", ".scroll-progress",
        ".custom-cursor", ".page-transition", "nav", ".nav-links",
        ".footer-bottom", ".footer-legal"
    ]
    for selector in selectors_to_remove:
        for element in soup.select(selector):
            element.decompose()
            
    # Find all HTML comments and remove them
    comments = soup.find_all(string=lambda text: isinstance(text, Comment))
    for comment in comments:
        comment.extract()
        
    page_data = {
        "filename": page_filename,
        "title": page_title,
        "sections": []
    }
    
    # Let's look for sections or major containers
    sections = soup.find_all(["section", "div"])
    processed_sections = []
    
    # We want to identify distinct sections. A section is valid if it has content.
    # To avoid nesting issues (e.g. div inside section), we will first look at <section> elements.
    # If no <section> elements are found, we'll fallback to other block elements.
    html_sections = soup.find_all("section")
    if not html_sections:
        # Fallback to direct children of body, or divs that represent logical content blocks
        body = soup.body
        if body:
            html_sections = [c for c in body.children if c.name in ["div", "section", "main"]]
            
    # If we still have nothing, just parse the body
    if not html_sections and soup.body:
        html_sections = [soup.body]
        
    for index, sect in enumerate(html_sections):
        if not sect or sect.name == "header" or sect.name == "footer":
            continue
            
        # Skip if it is too small or contains no text
        sect_text = sect.get_text(strip=True)
        if len(sect_text) < 10:
            continue
            
        # Determine section name
        sect_name = ""
        
        # Try to find a heading in this section
        headings = sect.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
        labels = sect.select(".label")
        
        if labels:
            sect_name = clean_text(labels[0].get_text())
            
        if headings:
            main_heading = clean_text(headings[0].get_text())
            if sect_name:
                sect_name = f"{sect_name} — {main_heading}"
            else:
                sect_name = main_heading
                
        if not sect_name:
            # Fallback to section class or ID or index
            sect_id = sect.get("id", "")
            sect_classes = sect.get("class", [])
            sect_class = " ".join(sect_classes) if sect_classes else ""
            if sect_id:
                sect_name = f"Sezione ID: {sect_id}"
            elif sect_class:
                sect_name = f"Sezione ({sect_class})"
            else:
                sect_name = f"Sezione {index + 1}"
                
        # Now let's extract body text components from this section
        sect_contents = []
        
        # 1. Look for special content containers like .service-card-v3, .value-pillar, .badge-card, .material-card, .team-card, .card
        special_cards = sect.select(".service-card-v3, .value-pillar, .badge-card, .material-card, .team-card, .card, .stat-item, .stat-item-custom")
        
        # If there are special cards, let's extract them in structured format
        if special_cards:
            card_texts = []
            for card in special_cards:
                # Check for service cards with data-body
                card_title = ""
                card_body_text = ""
                
                # Check if it has custom data attributes (like in lavorazioni.html)
                if card.has_attr("data-title"):
                    card_title = card.get("data-title", "").strip()
                if card.has_attr("data-body"):
                    body_parts = card.get("data-body", "").split("|")
                    card_body_text = "\n\n".join([p.strip() for p in body_parts if p.strip()])
                    
                # Fallback to parsing contents of the card
                if not card_title:
                    card_h = card.find(["h3", "h4", "h5", "h6"])
                    if card_h:
                        card_title = clean_text(card_h.get_text())
                
                if not card_body_text:
                    card_ps = card.find_all("p")
                    card_p_texts = [clean_text(p.get_text()) for p in card_ps if clean_text(p.get_text())]
                    card_body_text = "\n".join(card_p_texts)
                    
                # Let's format this card
                formatted_card = ""
                if card_title:
                    formatted_card += f"■ {card_title}"
                if card_body_text:
                    if formatted_card:
                        indented_body = card_body_text.replace('\n', '\n  ')
                        formatted_card += f"\n  {indented_body}"
                    else:
                        formatted_card += card_body_text
                        
                if formatted_card:
                    card_texts.append(formatted_card)
                    
            if card_texts:
                sect_contents.append("\n\n".join(card_texts))
                
        # 2. Extract regular paragraphs and lists that are NOT nested inside the special cards to avoid duplication
        # We can do this by finding all direct or non-card-nested paragraphs and lists
        paragraphs = sect.find_all(["p", "li", "blockquote"])
        other_texts = []
        for p in paragraphs:
            # Check if this paragraph is inside a special card we already parsed
            inside_card = False
            for card in special_cards:
                if p.find_parent(class_=card.get("class")) or p.find_parent(id=card.get("id")) or p in card.descendants:
                    inside_card = True
                    break
            if inside_card:
                continue
                
            # Check if it's a subtitle or breadcrumb that we already parsed as part of header
            p_classes = p.get("class", [])
            p_class_str = " ".join(p_classes) if p_classes else ""
            if "breadcrumb" in p_class_str:
                continue
                
            p_text = clean_text(p.get_text())
            if p_text and p_text not in other_texts:
                # Add bullet for list items
                if p.name == "li":
                    other_texts.append(f"• {p_text}")
                else:
                    other_texts.append(p_text)
                    
        if other_texts:
            sect_contents.append("\n\n".join(other_texts))
            
        # Combine section content
        combined_content = "\n\n".join([c for c in sect_contents if c.strip()])
        
        # Verify if we actually extracted anything meaningful
        if combined_content.strip():
            page_data["sections"].append({
                "name": sect_name,
                "content": combined_content
            })
            
    # Append dynamic product data to the end of prodotti.html sections
    if page_filename == "prodotti.html" and dynamic_products:
        page_data["sections"].append({
            "name": "SCHEDE DETTAGLIATE PRODOTTI (Contenuto Dinamico)",
            "content": "\n\n".join(dynamic_products)
        })
            
    return page_data

def main():
    root_dir = "/Volumes/Extreme Pro/SITI INTERNET/SITO_RF"
    output_file = os.path.join(root_dir, "testi_sito.txt")
    
    print(f"Scansione della cartella: {root_dir}")
    
    # Find all .html files in the root folder (ignoring macOS ._ metadata files)
    html_files = [
        os.path.join(root_dir, f) for f in os.listdir(root_dir)
        if f.endswith(".html") and not f.startswith("._") and os.path.isfile(os.path.join(root_dir, f))
    ]
    
    # Sort files by name so the output is ordered
    html_files.sort()
    
    if not html_files:
        print("Nessun file .html trovato nella cartella root!")
        sys.exit(1)
        
    print(f"Trovati {len(html_files)} file HTML da elaborare.")
    
    all_pages_data = []
    for file_path in html_files:
        print(f"Elaborazione in corso: {os.path.basename(file_path)}")
        try:
            page_data = extract_texts_from_html(file_path)
            all_pages_data.append(page_data)
        except Exception as e:
            print(f"Errore durante l'elaborazione di {os.path.basename(file_path)}: {e}")
            
    # Write everything to the output file
    with open(output_file, "w", encoding="utf-8") as out:
        out.write("========================================================================\n")
        out.write("                   TESTI DI TUTTE LE PAGINE DEL SITO                    \n")
        out.write("========================================================================\n\n")
        
        for page in all_pages_data:
            out.write(f"📄 PAGINA: {page['filename']}\n")
            out.write(f"📌 TITOLO: {page['title']}\n")
            out.write("=" * 60 + "\n\n")
            
            if not page["sections"]:
                out.write("[Nessun corpo testo significativo estratto da questa pagina]\n\n")
            else:
                for idx, sect in enumerate(page["sections"]):
                    out.write(f"📂 SEZIONE: {sect['name'].upper()}\n")
                    out.write("-" * 40 + "\n")
                    out.write(f"{sect['content']}\n\n")
                    
            out.write("\n" + "=" * 80 + "\n\n")
            
    print(f"\nElaborazione completata! Tutti i testi sono stati salvati in:")
    print(f"👉 {output_file}")
    
if __name__ == "__main__":
    main()
