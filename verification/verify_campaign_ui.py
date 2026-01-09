import time
from playwright.sync_api import sync_playwright, expect

def verify_campaign_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock LocalStorage for Login Bypass
        page.goto("http://localhost:3000/login")

        # Inject mock token and user
        page.evaluate("""
            localStorage.setItem('token', 'mock-token');
            localStorage.setItem('user', JSON.stringify({
                id: 'mock-user-id',
                name: 'Test User',
                email: 'test@example.com',
                avatarUrl: 'https://via.placeholder.com/150'
            }));
        """)

        # Navigate to Dashboard
        page.goto("http://localhost:3000/dashboard")

        # Switch to Campaign Tab
        page.get_by_text("Automação (Funil)").click()

        # Click on "Nova Campanha" button
        page.get_by_role("button", name="Nova Campanha").click()

        # Wait for Modal to appear
        expect(page.get_by_role("dialog").get_by_text("Nova Campanha")).to_be_visible()

        # Check for Content Mode Radio Group
        expect(page.get_by_text("Modo de Conteúdo")).to_be_visible()

        # Initial State: Static
        # Relaxing exact=True because FormLabel might add asterisk or other elements,
        # or it might be "Mensagem" inside a label
        # We will check if the Textarea is visible and its label is likely correct
        expect(page.get_by_text("Mensagem Fixa (Padrão)")).to_be_visible()

        # Switch to AI Mode
        page.get_by_text("Gerado por IA (Dinâmico)").click()

        # Verify Label Change
        # We wait a bit or check visibility of the new label
        expect(page.get_by_text("Instrução para a IA")).to_be_visible()

        # Verify Warning Text
        expect(page.get_by_text("A IA usará o histórico da conversa para personalizar esta mensagem para cada cliente.")).to_be_visible()

        # Verify Placeholder (partial match)
        textarea = page.locator("textarea")
        expect(textarea).to_have_attribute("placeholder", "Ex: Analise a última conversa e convide o {nome} para retornar, oferecendo 10% de desconto. Use um tom amigável.")

        # Take Screenshot
        page.screenshot(path="verification/campaign_ui.png")
        print("Verification Successful. Screenshot saved to verification/campaign_ui.png")

        browser.close()

if __name__ == "__main__":
    verify_campaign_ui()
