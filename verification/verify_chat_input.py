import requests
import time
import os
from playwright.sync_api import sync_playwright, expect

API_URL = "http://localhost:3001"
FRONTEND_URL = "http://localhost:3000"

os.makedirs("/home/jules/verification", exist_ok=True)

def setup_data():
    # 1. Register
    email = f"test{int(time.time())}@example.com"
    password = "password123"
    print(f"Registering user: {email}")
    try:
        res = requests.post(f"{API_URL}/api/auth/register", json={
            "name": "Test User",
            "email": email,
            "password": password
        })
        if res.status_code not in [200, 201]:
            print("Registration failed:", res.text)
            return None, None
    except Exception as e:
        print(f"Failed to connect to backend: {e}")
        return None, None

    # 2. Login to get token
    res = requests.post(f"{API_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    token = res.json().get('token')

    # 3. Create Contact via Visitor Message
    res = requests.get(f"{API_URL}/api/business/config", headers={"Authorization": f"Bearer {token}"})
    if res.status_code != 200:
        print("Failed to get business config")
        return None, None

    business_id = res.json().get('_id')
    print(f"Business ID: {business_id}")

    session_id = f"visitor{int(time.time())}"
    res = requests.post(f"{API_URL}/api/chat/send", json={
        "businessId": business_id,
        "sessionId": session_id,
        "message": "Hello from Visitor"
    })
    print("Visitor message sent:", res.status_code)

    return email, password

def run_test():
    # Wait for services to be ready
    print("Waiting for services...")
    time.sleep(5)

    email, password = setup_data()
    if not email:
        print("Setup failed. Exiting.")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        print("Navigating to login...")
        page.goto(f"{FRONTEND_URL}/login")

        # Check if we are already logged in (unlikely in new context) or login page loaded
        page.wait_for_selector("input[type='email']")

        page.fill("input[type='email']", email)
        page.fill("input[type='password']", password)
        page.click("button[type='submit']")

        print("Waiting for dashboard...")
        try:
            page.wait_for_url(f"{FRONTEND_URL}/dashboard", timeout=10000)
        except:
            print("Failed to reach dashboard. Current URL:", page.url)
            page.screenshot(path="/home/jules/verification/login_failed.png")
            return

        print("Going to Live Chat tab...")
        page.click("text=Live Chat")

        # Wait for contact list to populate
        print("Waiting for 'Visitante'...")
        try:
            page.wait_for_selector("text=Visitante", timeout=10000)
        except:
            print("Contact not found on list. Dumping content.")
            print(page.content())
            page.screenshot(path="/home/jules/verification/contact_list_failed.png")
            browser.close()
            return

        # Select contact
        page.click("text=Visitante")

        print("Verifying Input...")
        # Verify Input exists
        expect(page.locator("input[placeholder='Digite sua resposta...']")).to_be_visible()
        expect(page.locator("button[aria-label='Enviar']")).to_be_visible()

        # Verify Banner "IA Ativa" (Bot is active by default)
        expect(page.locator("text=IA Ativa")).to_be_visible()

        print("Toggling Handover...")
        # Toggle Handover
        # Find switch. The label is "Robô Ativo" or "Pausado (Humano)"
        # <FormLabel htmlFor='handover-switch'>
        page.locator("label[for='handover-switch']").click()

        # Wait for banner change
        print("Verifying Handover Banner...")
        # Use more specific text to avoid collision with toast
        expect(page.locator("text=Você está no controle da conversa")).to_be_visible()

        # Verify Input STILL exists and is enabled
        print("Verifying Input availability...")
        expect(page.locator("input[placeholder='Digite sua resposta...']")).to_be_visible()
        expect(page.locator("input[placeholder='Digite sua resposta...']")).to_be_enabled()

        # Send a message
        print("Sending message...")
        page.fill("input[placeholder='Digite sua resposta...']", "Hello Agent")
        page.click("button[aria-label='Enviar']")

        # Verify message appears in chat
        print("Verifying message in chat...")
        expect(page.locator("text=Hello Agent")).to_be_visible()

        # Take screenshot
        page.screenshot(path="/home/jules/verification/verification.png")
        print("Verification complete. Screenshot saved.")
        browser.close()

if __name__ == "__main__":
    run_test()
