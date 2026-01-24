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
    page.get_by_placeholder("seu@email.com").nth(1).fill(email) # There are two email inputs (login and register)
    page.get_by_placeholder("Mínimo 6 caracteres").fill("password123")
    page.get_by_placeholder("Confirme sua senha").fill("password123")

    # Submit
    page.get_by_role("button", name="Criar Conta").click()

    # Wait for dashboard
    expect(page).to_have_url("http://localhost:3000/dashboard", timeout=10000)

    # 2. Go to Funnel Page
    page.goto("http://localhost:3000/funnel")

    # Wait for board to load (FunnelBoard renders DragDropContext)
    # We can look for a column. Default columns usually exist or we create them?
    # If funnel is empty, it shows "Seu Funil de Vendas está vazio".
    # I should check for either empty state or board.

    # Let's wait a bit for data fetch
    time.sleep(2)

    # Take screenshot
    page.screenshot(path="verification/verification.png")
    print("Screenshot taken at verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_funnel_optimization(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
