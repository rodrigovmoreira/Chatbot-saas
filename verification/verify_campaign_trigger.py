
import os
import json
from playwright.sync_api import sync_playwright, expect

# Constants
BASE_URL = "http://localhost:3000"
SCREENSHOT_PATH = "verification/campaign_modal_trigger.png"

# Mock Data
MOCK_USER = {
    "id": "mock-user-id",
    "name": "Test User",
    "email": "test@example.com",
    "avatarUrl": "https://example.com/avatar.png"
}
MOCK_TOKEN = "mock-jwt-token"

def verify_campaign_modal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant permissions for clipboard if needed, though not strictly required here
        context = browser.new_context(
             viewport={'width': 1280, 'height': 800}
        )

        # Inject LocalStorage
        # We need to navigate to the domain first to set localStorage
        page = context.new_page()

        # We can go to login page first, then inject
        page.goto(f"{BASE_URL}/login")

        page.evaluate(f"""
            localStorage.setItem('user', '{json.dumps(MOCK_USER)}');
            localStorage.setItem('token', '{MOCK_TOKEN}');
        """)

        # Now navigate to dashboard which should redirect to default tab or load
        page.goto(f"{BASE_URL}/dashboard")

        # Wait for Sidebar to ensure we are logged in
        try:
            expect(page.get_by_text("Automação (Funil)")).to_be_visible(timeout=10000)
        except:
             # If strictly redirecting or needing specific URL
             print("Dashboard didn't load sidebar immediately, checking URL...")

        # Click on 'Automação (Funil)' to go to Campaign Tab
        # Note: In the memory, 'Automação (Funil)' was added to Sidebar.
        # But wait, CampaignTab is inside Dashboard tabs.
        # I need to know which Tab index or if I can click navigation.
        # Assuming Dashboard loads CampaignTab or I can navigate.
        # Let's try to click the sidebar link if it exists.

        page.get_by_text("Automação (Funil)").click()

        # Wait for "Nova Campanha" button
        expect(page.get_by_role("button", name="Nova Campanha")).to_be_visible()

        # Click "Nova Campanha"
        page.get_by_role("button", name="Nova Campanha").click()

        # Wait for Modal
        # The modal header has 'Nova Campanha' but so does the button.
        # We can look for the "Mensagem" label or "Gatilho de Envio" which is inside the modal.
        expect(page.get_by_role("dialog", name="Nova Campanha")).to_be_visible()

        # Check for "Gatilho de Envio"
        expect(page.get_by_text("Gatilho de Envio")).to_be_visible()

        # Click "Lembrete da Agenda"
        page.get_by_text("Lembrete da Agenda").click()

        # Check for new inputs
        expect(page.get_by_text("Regra de Agendamento")).to_be_visible()
        expect(page.get_by_text("Enviar com antecedência de")).to_be_visible()

        # Verify Helper Text
        expect(page.get_by_text("Variáveis disponíveis: {nome_cliente}, {data_agendamento}, {hora_agendamento}.")).to_be_visible()

        # Take screenshot
        page.screenshot(path=SCREENSHOT_PATH)
        print(f"Screenshot saved to {SCREENSHOT_PATH}")

        browser.close()

if __name__ == "__main__":
    verify_campaign_modal()
