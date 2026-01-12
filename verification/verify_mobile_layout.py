import json
import time
from playwright.sync_api import sync_playwright

def verify_mobile_layout():
    with sync_playwright() as p:
        # Launch browser with iPhone 12 emulation
        iphone_12 = p.devices['iPhone 12']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone_12)
        page = context.new_page()

        # Mock Auth
        with open('verification/mock_auth.json', 'r') as f:
            auth_data = json.load(f)

        # Inject auth data into localStorage before navigation
        page.goto("http://localhost:3000/login") # Go to login first to set storage
        page.evaluate(f"localStorage.setItem('token', '{auth_data['token']}')")
        page.evaluate(f"localStorage.setItem('user', '{json.dumps(auth_data['user'])}')")

        # Mock API calls to prevent blank screens or 401s
        page.route("**/api/business/config", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "businessName": "Test Corp",
                "products": [],
                "followUpSteps": [],
                "prompts": {},
                "menuOptions": [],
                "availableTags": []
            })
        ))
        page.route("**/api/appointments", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps([
                {"_id": "1", "title": "Corte de Cabelo", "clientName": "Carlos", "start": "2023-10-27T10:00:00", "end": "2023-10-27T11:00:00", "status": "scheduled"}
            ])
        ))
        page.route("**/api/campaigns", lambda route: route.fulfill(status=200, body="[]"))
        page.route("**/api/conversations", lambda route: route.fulfill(status=200, body="[]"))

        # Go to Dashboard
        page.goto("http://localhost:3000/dashboard")

        # Wait for content to load
        time.sleep(3)

        # 1. Verify Navigation (Hamburger Menu)
        print("Checking Navigation...")
        hamburger = page.locator('button[aria-label="open menu"]')
        if hamburger.is_visible():
            print("Hamburger menu visible.")
            hamburger.click()
            time.sleep(1)
            # Use specific selector to avoid ambiguity (look inside Drawer Content)
            # The Drawer content usually has a dialog role or specific class.
            # We can select the one that is visible.
            sidebar_items = page.locator('text=Funil de Atendimento')
            # Filter for the visible one
            visible_sidebar = sidebar_items.first # The Drawer one should be the second one usually, but let's try to be specific

            # Or better, look for the text inside the Drawer dialog
            drawer_content = page.locator('section[role="dialog"]')
            if drawer_content.is_visible():
                print("Drawer opened.")
                if drawer_content.get_by_text("Funil de Atendimento").is_visible():
                     print("Sidebar content confirmed inside Drawer.")
                     # Close drawer by clicking overlay or close button if present, or just outside
                     page.mouse.click(300, 300)
                     time.sleep(1)
            else:
                 print("Drawer dialog not found.")

        else:
            print("Hamburger menu NOT visible.")

        # 2. Verify Tabs Layout (Mobile)
        # We are on ConnectionTab by default. Check if layout is stacked.
        # Screenshot the main view
        page.screenshot(path="verification/mobile_dashboard.png")
        print("Captured mobile_dashboard.png")

        # Navigate to ScheduleTab (Agendamentos - index 6)
        # We need to open menu first
        hamburger.click()
        time.sleep(1)
        # Click "Agendamentos" inside the drawer
        page.locator('section[role="dialog"]').get_by_text('Agendamentos').click()
        time.sleep(2)

        # Verify Mobile Card View
        agenda_card_view = page.locator('text=Agenda') # The header in mobile view
        if agenda_card_view.first.is_visible(): # Use first in case of duplicates
             print("Schedule Mobile View is active.")
        else:
             print("Schedule Mobile View NOT found (might be desktop table?).")

        page.screenshot(path="verification/mobile_schedule.png")
        print("Captured mobile_schedule.png")

        browser.close()

if __name__ == "__main__":
    verify_mobile_layout()
