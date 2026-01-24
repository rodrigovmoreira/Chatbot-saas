from playwright.sync_api import Page, expect, sync_playwright
import time
import random

def test_funnel_optimization(page: Page):
    # 1. Register a new user
    page.goto("http://localhost:3000/login")

    # Click Register tab
    page.get_by_role("tab", name="Cadastro").click()

    # Fill form
    random_id = random.randint(1000, 9999)
    email = f"testUser{random_id}@example.com"

    page.get_by_placeholder("Seu nome completo").fill("Test User")
    page.get_by_placeholder("seu@email.com").nth(1).fill(email)
    page.get_by_placeholder("Mínimo 6 caracteres").fill("password123")
    page.get_by_placeholder("Confirme sua senha").fill("password123")

    # Submit
    page.get_by_role("button", name="Criar Conta").click()

    # Wait for dashboard
    expect(page).to_have_url("http://localhost:3000/dashboard", timeout=10000)

    # 2. Go to Funnel Page
    page.goto("http://localhost:3000/funnel")

    # 3. Configure Funnel
    # Click "Configurar meu Funil"
    page.get_by_role("button", name="Configurar meu Funil").click()

    # Wait for modal
    time.sleep(1)

    # Select "Lead" tag
    # Using generic locator because Checkbox implementation details might vary
    page.locator("label").filter(has_text="Lead").click()

    # Save
    page.get_by_role("button", name="Salvar Configuração").click()

    # Wait for modal to close and board to render
    time.sleep(2)

    # Take screenshot of Board
    page.screenshot(path="verification/verification_board.png")
    print("Screenshot taken at verification/verification_board.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_funnel_optimization(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_board.png")
        finally:
            browser.close()
