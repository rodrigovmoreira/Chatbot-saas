from playwright.sync_api import Page, expect, sync_playwright
import time
import uuid

def verify_intelligence_tab(page: Page):
    print("Navigating to login page...")
    page.goto("http://localhost:3000/login")

    # 1. Login/Register
    print("Switching to Register tab...")
    page.get_by_role("tab", name="Cadastro").click()

    email = f"user_{uuid.uuid4()}@test.com"
    password = "password123"

    print(f"Registering with email: {email}")

    page.get_by_placeholder("Seu nome completo").fill("Test User")

    # Find the register form container
    register_form = page.locator("form").filter(has_text="Criar Conta")

    # Fill email in register form
    register_form.locator("input[placeholder='seu@email.com']").fill(email)

    register_form.locator("input[placeholder='Mínimo 6 caracteres']").fill(password)
    register_form.locator("input[placeholder='Confirme sua senha']").fill(password)

    print("Submitting registration...")
    page.get_by_role("button", name="Criar Conta").click()

    # Wait for Dashboard
    print("Waiting for Dashboard...")
    expect(page).to_have_url("http://localhost:3000/dashboard", timeout=30000)

    # 2. Navigate to Intelligence Tab
    print("Navigating to Intelligence tab...")
    page.get_by_text("Inteligência & Nicho").click()

    # Wait for the tab content to load
    page.wait_for_selector("text=Modelos Padrão (Sistema)")

    # 3. Verify Preset Selection
    print("Selecting preset...")
    # Select value="barber" from the first select
    page.locator("select").nth(0).select_option("barber")

    # 4. Assert State Update
    print("Verifying inputs...")

    # Check Name input
    # Wait for update
    time.sleep(1)

    name_input = page.get_by_label("Nome do Robô")
    expect(name_input).to_have_value("Viktor")

    # Check Tone input (now an Input)
    tone_input = page.get_by_label("Tom de Voz")
    val = tone_input.input_value()
    print(f"Tone value: {val}")
    assert "Camarada" in val

    # Check Custom Instructions
    instructions_area = page.get_by_placeholder("Regras específicas. Ex: 'Não aceite cartões de crédito', 'Sempre peça o nome do cliente'.")
    val_instr = instructions_area.input_value()
    print(f"Instructions value length: {len(val_instr)}")
    assert "Converter conversas" in val_instr

    print("Taking screenshot...")
    page.screenshot(path="verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_intelligence_tab(page)
            print("Verification Successful!")
        except Exception as e:
            print(f"Verification Failed: {e}")
            try:
                page.screenshot(path="verification/error.png")
            except:
                pass
            raise e
        finally:
            browser.close()
