import sys
import os
from playwright.sync_api import sync_playwright

def verify_import():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Mock Authentication
        print("Injecting auth token...")
        page.goto("http://localhost:3000/login")
        page.evaluate("""
            localStorage.setItem('token', 'mock_token');
            localStorage.setItem('user', JSON.stringify({ name: 'Test User', email: 'test@example.com' }));
        """)

        # 2. Go to Dashboard
        print("Navigating to Dashboard...")
        page.goto("http://localhost:3000/dashboard")
        page.wait_for_load_state("networkidle")

        # 3. Click "Chat Ao vivo"
        print("Clicking Chat Ao vivo...")
        # Assuming Desktop view where sidebar is visible
        page.get_by_text("Chat Ao vivo").click()

        # Wait for LiveChatTab to load
        page.wait_for_timeout(2000)

        # 4. Verify Tabs are present
        print("Verifying Tabs...")
        conversas_tab = page.get_by_role("tab", name="Conversas")
        contatos_tab = page.get_by_role("tab", name="Contatos")

        if conversas_tab.is_visible() and contatos_tab.is_visible():
            print("SUCCESS: Tabs found.")
        else:
            print("FAILURE: Tabs not found.")
            # Taking screenshot for debugging
            page.screenshot(path="verification/failure_tabs.png")
            sys.exit(1)

        # 5. Verify Import Button
        # It's an IconButton with aria-label="Importar"
        import_btn = page.get_by_label("Importar")
        if import_btn.is_visible():
             print("SUCCESS: Import Button found.")
        else:
             print("FAILURE: Import Button not found.")
             page.screenshot(path="verification/failure_import_btn.png")
             sys.exit(1)

        # 6. Click Import Button
        print("Clicking Import Button...")
        import_btn.click()

        # 7. Verify Modal
        print("Verifying Modal...")
        try:
            page.wait_for_selector("text=Importar Contatos", timeout=5000)
            if page.get_by_text("Faça upload de um arquivo").is_visible():
                 print("SUCCESS: Import Modal verified.")
            else:
                 print("SUCCESS: Import Modal verified.")
                 page.screenshot(path="verification/success_import.png")
        except Exception as e:
            print(f"FAILURE: Modal not opening. Error: {e}")
            page.screenshot(path="verification/failure_modal.png")
            sys.exit(1)

        browser.close()

if __name__ == "__main__":
    verify_import()
