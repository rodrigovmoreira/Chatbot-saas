from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        def handle_response(res):
            print(f"RESP: {res.url} {res.status}")
            if "config" in res.url:
                try:
                    print(f"BODY: {res.json()}")
                except:
                    pass

        page.on("response", handle_response)
        page.on("requestfailed", lambda req: print(f"REQ FAILED: {req.url} {req.failure}"))

        print("Navigating...")
        try:
            page.goto("http://localhost:3000/chat/6941d6f2f638ac7dd55e0713")
            page.wait_for_timeout(3000)
        except Exception as e:
            print(f"Script Error: {e}")

        browser.close()

if __name__ == "__main__":
    run()
