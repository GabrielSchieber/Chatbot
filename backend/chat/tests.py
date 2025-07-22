import time

from channels.testing import ChannelsLiveServerTestCase
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from django.test import TestCase
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select

from chat.models import Chat, Message, User

class UserTests(TestCase):
    def test_creation(self):
        user = create_user()
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")
        self.assertTrue(check_password("testpassword", user.password))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)

    def test_authentication(self):
        create_user()
        user = authenticate(email = "test@example.com", password = "testpassword")
        self.assertEqual(type(user), User)
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.email, "testpassword")

class ChatTests(TestCase):
    def test_creation(self):
        user = create_user()
        chat = Chat.objects.create(user = user, title = "Test chat")
        self.assertEqual(chat.user, user)
        self.assertEqual(chat.title, "Test chat")
        self.assertTrue(chat.is_complete)

class MessageTests(TestCase):
    def test_creation(self):
        user = create_user()
        chat = Chat.objects.create(user = user, title = "Test chat")
        user_message = Message.objects.create(chat = chat, text = "Hello!", is_user_message = True)
        bot_message = Message.objects.create(chat = chat, text = "Hi!", is_user_message = False)
        self.assertEqual(user_message.chat, chat)
        self.assertEqual(bot_message.chat, chat)
        self.assertEqual(user_message.text, "Hello!")
        self.assertEqual(bot_message.text, "Hi!")
        self.assertTrue(user_message.is_user_message)
        self.assertFalse(bot_message.is_user_message)

class ViewTests(TestCase):
    def test_signup(self):
        response = self.client.post("/api/signup/", {"email": "test@example.com", "password": "testpassword"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.all().count(), 1)
        user = User.objects.first()
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")
        self.assertTrue(check_password("testpassword", user.password))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)

    def test_signup_with_existing_email(self):
        create_user()
        response = self.client.post("/api/signup/", {"email": "test@example.com", "password": "testpassword"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.all().count(), 1)

    def test_login(self):
        _, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)

    def test_login_with_invalid_credentials(self):
        create_user()
        response = self.login_user("someemail@example.com", "somepassword")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Invalid credentials")

        response = self.login_user("test@example.com", "somepassword")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Invalid credentials")

        response = self.login_user("someemail@example.com", "testpassword")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Invalid credentials")

    def test_logout(self):
        self.create_and_login_user()
        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)

    def test_logout_without_being_authenticated(self):
        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Authentication credentials were not provided.")

    def test_me(self):
        user, _ = self.create_and_login_user()
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], user.id)
        self.assertEqual(response.json()["email"], user.email)

    def test_get_message(self):
        response = self.client.post("/api/get-message/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/get-message/", {"chat_uuid": "849087f8-4b3f-47f1-980d-5a5a3d325912", "message_index": 0})
        self.assertEqual(response.status_code, 401)

        user, _ = self.create_and_login_user()
        response = self.client.post("/api/get-message/", {"chat_uuid": "849087f8-4b3f-47f1-980d-5a5a3d325912", "message_index": 0})
        self.assertEqual(response.status_code, 400)

        chat = Chat.objects.create(user = user, title = "Test chat")
        response = self.client.post("/api/get-message/", {"chat_uuid": chat.uuid, "message_index": 0})
        self.assertEqual(response.status_code, 400)

        Message.objects.create(chat = chat, text = "Hello!", is_user_message = True)
        Message.objects.create(chat = chat, text = "Hi!", is_user_message = False)

        response = self.client.post("/api/get-message/", {"chat_uuid": chat.uuid, "message_index": 0})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], "Hello!")

        response = self.client.post("/api/get-message/", {"chat_uuid": chat.uuid, "message_index": 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], "Hi!")

    def test_get_messages(self):
        response = self.client.post("/api/get-messages/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/get-messages/", {"chat_uuid": "849087f8-4b3f-47f1-980d-5a5a3d325912"})
        self.assertEqual(response.status_code, 401)

        user, _ = self.create_and_login_user()
        response = self.client.post("/api/get-messages/", {"chat_uuid": "849087f8-4b3f-47f1-980d-5a5a3d325912"})
        self.assertEqual(response.status_code, 400)

        chat = Chat.objects.create(user = user, title = "Test chat")
        response = self.client.post("/api/get-messages/", {"chat_uuid": "invalid-uuid"})
        self.assertEqual(response.status_code, 400)

        chat = Chat.objects.create(user = user, title = "Test chat")
        response = self.client.post("/api/get-messages/", {"chat_uuid": chat.uuid})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["messages"], [])

        Message.objects.create(chat = chat, text = "Hello!", is_user_message = True)
        Message.objects.create(chat = chat, text = "Hi!", is_user_message = False)

        response = self.client.post("/api/get-messages/", {"chat_uuid": chat.uuid})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["messages"], ["Hello!", "<p>Hi!</p>"])

        Message.objects.create(chat = chat, text = "Hello again!", is_user_message = True)
        Message.objects.create(chat = chat, text = "Hi again!", is_user_message = False)

        response = self.client.post("/api/get-messages/", {"chat_uuid": chat.uuid})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["messages"], ["Hello!", "<p>Hi!</p>", "Hello again!", "<p>Hi again!</p>"])

    def test_get_chats(self):
        response = self.client.post("/api/get-chats/")
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.post("/api/get-chats/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.post("/api/get-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        chat1 = Chat.objects.create(user = user1, title = "Test chat 1")
        response = self.client.post("/api/get-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": chat1.title, "uuid": str(chat1.uuid)}])

        chat2 = Chat.objects.create(user = user1, title = "Test chat 2")
        response = self.client.post("/api/get-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": chat1.title, "uuid": str(chat1.uuid)}, {"title": chat2.title, "uuid": str(chat2.uuid)}])

        self.logout_user()
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        response = self.client.post("/api/get-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        chat3 = Chat.objects.create(user = user2, title = "Test chat 3")
        response = self.client.post("/api/get-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": chat3.title, "uuid": str(chat3.uuid)}])

        chat4 = Chat.objects.create(user = user2, title = "Test chat 4")
        response = self.client.post("/api/get-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": chat3.title, "uuid": str(chat3.uuid)}, {"title": chat4.title, "uuid": str(chat4.uuid)}])

    def test_search_chats(self):
        response = self.client.post("/api/search-chats/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/search-chats/", {"search": "What is math?"})
        self.assertEqual(response.status_code, 401)

        user, _ = self.create_and_login_user()
        response = self.client.post("/api/search-chats/")
        self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/search-chats/", {"search": "What is math?"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        chat = Chat.objects.create(user = user, title = "A question about math")

        response = self.client.post("/api/search-chats/", {"search": "What is math?"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        response = self.client.post("/api/search-chats/", {"search": "A question about math"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "A question about math", "uuid": str(chat.uuid), "matches": []}])

        Message.objects.create(chat = chat, text = "What is math?", is_user_message = True)
        Message.objects.create(chat = chat, text = "Math is...", is_user_message = False)

        response = self.client.post("/api/search-chats/", {"search": "What is math?"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "A question about math", "uuid": str(chat.uuid), "matches": ["What is math?"]}])

        response = self.client.post("/api/search-chats/", {"search": "math"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "A question about math", "uuid": str(chat.uuid), "matches": ["What is math?", "Math is..."]}])

        response = self.client.post("/api/search-chats/", {"search": "What is geometry?"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        chat = Chat.objects.create(user = user, title = "Geometry question")

        response = self.client.post("/api/search-chats/", {"search": "Question about geometry"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        response = self.client.post("/api/search-chats/", {"search": "Geometry question"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "Geometry question", "uuid": str(chat.uuid), "matches": []}])

        Message.objects.create(chat = chat, text = "What is geometry?", is_user_message = True)
        Message.objects.create(chat = chat, text = "Geometry is...", is_user_message = False)

        response = self.client.post("/api/search-chats/", {"search": "What is geometry?"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "Geometry question", "uuid": str(chat.uuid), "matches": ["What is geometry?"]}])

        response = self.client.post("/api/search-chats/", {"search": "geometry"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "Geometry question", "uuid": str(chat.uuid), "matches": ["What is geometry?", "Geometry is..."]}])

    def test_rename_chat(self):
        response = self.client.post("/api/rename-chat/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"})
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.post("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"})
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.post("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"})
        self.assertEqual(response.status_code, 400)

        chat1 = Chat.objects.create(user = user1, title = "Test title")
        response = self.client.post("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"})
        self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/rename-chat/", {"chat_uuid": chat1.uuid, "new_title": "Some title"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.first().title, "Some title")

        self.logout_user()
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        chat2 = Chat.objects.create(user = user2, title = "Some chat")
        response = self.client.post("/api/rename-chat/", {"chat_uuid": chat2.uuid, "new_title": "Some other chat"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.first().title, "Some title")
        self.assertEqual(Chat.objects.last().title, "Some other chat")

    def test_delete_chat(self):
        response = self.client.post("/api/delete-chat/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/delete-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.post("/api/delete-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.post("/api/delete-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 400)

        chat1 = Chat.objects.create(user = user1, title = "Test chat 1")

        response = self.client.post("/api/delete-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/delete-chat/", {"chat_uuid": chat1.uuid})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.count(), 0)

        Chat.objects.create(user = user1, title = "Test chat 2")

        self.logout_user()
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = Chat.objects.create(user = user2, title = "Test chat 3")
        response = self.client.post("/api/delete-chat/", {"chat_uuid": chat3.uuid})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.count(), 1)
        self.assertEqual(Chat.objects.first().user, user1)

    def test_delete_chats(self):
        response = self.client.post("/api/delete-chats/")
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.post("/api/delete-chats/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.post("/api/delete-chats/")
        self.assertEqual(response.status_code, 200)

        Chat.objects.create(user = user1, title = "Test chat 1")
        response = self.client.post("/api/delete-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.count(), 0)

        Chat.objects.create(user = user1, title = "Test chat 2")
        Chat.objects.create(user = user1, title = "Test chat 3")

        response = self.client.post("/api/delete-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.count(), 0)

        Chat.objects.create(user = user1, title = "Test chat 4")
        Chat.objects.create(user = user1, title = "Test chat 5")

        self.logout_user()
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        Chat.objects.create(user = user2, title = "Test chat 6")
        Chat.objects.create(user = user2, title = "Test chat 7")
        response = self.client.post("/api/delete-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.count(), 2)
        self.assertEqual(Chat.objects.first().user, user1)
        self.assertEqual(Chat.objects.last().user, user1)

    def test_delete_account(self):
        response = self.client.post("/api/delete-account/")
        self.assertEqual(response.status_code, 401)

        create_user()
        response = self.client.post("/api/delete-account/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.post("/api/delete-account/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.count(), 0)

        create_user()
        user = create_user("someone@example.com", "somepassword")

        self.login_user("test@example.com", "testpassword")
        response = self.client.post("/api/delete-account/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.first(), user)

    def login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        return self.client.post("/api/login/", {"email": email, "password": password})

    def logout_user(self):
        return self.client.post("/api/logout/")

    def create_and_login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        user = create_user(email, password)
        response = self.client.post("/api/login/", {"email": email, "password": password})
        return user, response

class SeleniumTests(StaticLiveServerTestCase):
    def setUp(self):
        self.driver = webdriver.Edge()

    def tearDown(self):
        self.driver.quit()

    def test_signup(self):
        self.driver.get(f"{self.live_server_url}/signup")
        self.assertEqual(self.driver.find_element(By.ID, "title-h1").text, "Sign up")

        self.email_input().send_keys("test@example.com" + Keys.ENTER)
        self.password_input().send_keys("testpassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)

        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.first().email, "test@example.com")
        self.assertNotEqual(User.objects.first().password, "testpassword")
        self.assertTrue(check_password("testpassword", User.objects.first().password))

    def test_login(self):
        create_user()

        self.driver.get(f"{self.live_server_url}/login")
        self.assertEqual(self.driver.find_element(By.ID, "title-h1").text, "Log in")

        self.email_input().send_keys("test@example.com" + Keys.ENTER)
        self.password_input().send_keys("testpassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)

    def test_index_search(self):
        user1 = create_user()

        chat1 = Chat.objects.create(user = user1, title = "What is Mathematics")
        user_message1 = Message.objects.create(chat = chat1, text = "What is Mathematics?", is_user_message = True)
        bot_message1 = Message.objects.create(chat = chat1, text = "Mathematics is a vast and fascinating field that has captivated human imagination for centuries. At its core, mathematics is the systematic study of patterns, relationships, and structures that underlie the natural and social worlds. It encompasses a wide range of disciplines, including algebra, geometry, calculus, number theory, topology, and beyond.", is_user_message = False)

        self.driver.get(f"{self.live_server_url}/login")
        self.email_input().send_keys("test@example.com" + Keys.ENTER)
        self.password_input().send_keys("testpassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)

        self.open_search_button().click()
        self.assertEqual(self.search_input().text, "")
        self.assertIn("Search here...", self.search_input().get_attribute("outerHTML"))
        self.assertEqual(len(self.search_entry_as()), 1)
        self.assertIn(chat1.title, self.search_entry_as()[0].text)
        self.assertIn(user_message1.text[:10], self.search_entry_as()[0].text)
        self.assertIn(bot_message1.text[:10], self.search_entry_as()[0].text)

        self.driver.get(self.live_server_url)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)
        time.sleep(2)

        chat2 = Chat.objects.create(user = user1, title = "A question about Geometry")
        user_message2 = Message.objects.create(chat = chat2, text = "What is Geometry?", is_user_message = True)
        bot_message2 = Message.objects.create(chat = chat2, text = "Geometry is...", is_user_message = False)

        self.open_search_button().click()
        self.assertEqual(self.search_input().text, "")
        self.assertIn("Search here...", self.search_input().get_attribute("outerHTML"))
        self.assertEqual(len(self.search_entry_as()), 2)
        self.assertIn(chat1.title, self.search_entry_as()[0].text)
        self.assertIn(chat2.title, self.search_entry_as()[1].text)
        self.assertIn(user_message1.text[:10], self.search_entry_as()[0].text)
        self.assertIn(user_message2.text[:10], self.search_entry_as()[1].text)
        self.assertIn(bot_message1.text[:10], self.search_entry_as()[0].text)
        self.assertIn(bot_message2.text[:10], self.search_entry_as()[1].text)

        self.body().send_keys(Keys.ESCAPE)
        self.open_settings_button().click()
        self.logout_button().click()
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/login", 3)

        user2 = create_user("someone@example.com", "somepassword")

        self.email_input().send_keys("someone@example.com" + Keys.ENTER)
        self.password_input().send_keys("somepassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)

        chat3 = Chat.objects.create(user = user2, title = "Python language")
        user_message3 = Message.objects.create(chat = chat3, text = "Tell me what Python is.", is_user_message = True)
        bot_message3 = Message.objects.create(chat = chat3, text = "Python is a programming language...?", is_user_message = False)

        self.open_search_button().click()
        self.assertEqual(self.search_input().text, "")
        self.assertIn("Search here...", self.search_input().get_attribute("outerHTML"))
        self.assertEqual(len(self.search_entry_as()), 1)
        self.assertIn(chat3.title, self.search_entry_as()[0].text)
        self.assertIn(user_message3.text[:10], self.search_entry_as()[0].text)
        self.assertIn(bot_message3.text[:10], self.search_entry_as()[0].text)

    def test_settings_panel(self):
        create_user()
        self.driver.get(f"{self.live_server_url}/login")
        self.wait_until(lambda _: len(self.driver.find_elements(By.TAG_NAME, "input") ) == 2)
        self.email_input().send_keys("test@example.com" + Keys.ENTER)
        self.password_input().send_keys("testpassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)

        self.open_settings()

        self.assertEqual(self.theme_select().text, "System\nLight\nDark")
        self.assertEqual(self.theme_select().get_attribute("value"), "system")

        theme_select = Select(self.theme_select())
        self.assertFalse(theme_select.is_multiple)
        self.assertEqual(len(theme_select.options), 3)
        self.assertEqual(theme_select.options[0].text, "System")
        self.assertEqual(theme_select.options[0].get_attribute("value"), "system")
        self.assertEqual(theme_select.options[1].text, "Light")
        self.assertEqual(theme_select.options[1].get_attribute("value"), "light")
        self.assertEqual(theme_select.options[2].text, "Dark")
        self.assertEqual(theme_select.options[2].get_attribute("value"), "dark")

        self.assertEqual(self.delete_chats_button().text, "Delete all")
        self.assertEqual(self.delete_account_button().text, "Delete")
        self.assertEqual(self.logout_button().text, "Log out")

    def test_settings_theme_select(self):
        create_user()
        self.driver.get(f"{self.live_server_url}/login")
        self.wait_until(lambda _: len(self.driver.find_elements(By.TAG_NAME, "input") ) == 2)
        self.email_input().send_keys("test@example.com" + Keys.ENTER)
        self.password_input().send_keys("testpassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)

        background_color = self.driver.execute_script("return getComputedStyle(arguments[0]).backgroundColor", self.body())
        self.assertIn(background_color, ["rgb(200, 202, 205)", "rgb(35, 37, 40)"])

        self.open_settings()
        theme_select = Select(self.theme_select())
        theme_select.select_by_visible_text("Light")
        self.close_settings()

        background_color = self.driver.execute_script("return getComputedStyle(arguments[0]).backgroundColor", self.body())
        self.assertEqual(background_color, "rgb(200, 202, 205)")

        self.open_settings()
        theme_select = Select(self.theme_select())
        theme_select.select_by_visible_text("Dark")
        self.close_settings()

        background_color = self.driver.execute_script("return getComputedStyle(arguments[0]).backgroundColor", self.body())
        self.assertEqual(background_color, "rgb(35, 37, 40)")

        self.open_settings()
        theme_select = Select(self.theme_select())
        theme_select.select_by_visible_text("System")
        self.close_settings()

        background_color = self.driver.execute_script("return getComputedStyle(arguments[0]).backgroundColor", self.body())
        self.assertIn(background_color, ["rgb(200, 202, 205)", "rgb(35, 37, 40)"])

    def test_settings_delete_chats(self):
        def create_chat_and_messages(user: User, title: str, message1: str, message2: str):
            chat = Chat.objects.create(user = user, title = title)
            Message.objects.create(chat = chat, text = message1, is_user_message = True)
            Message.objects.create(chat = chat, text = message2, is_user_message = False)

        user1 = create_user()
        self.driver.get(f"{self.live_server_url}/login")
        self.wait_until(lambda _: len(self.driver.find_elements(By.TAG_NAME, "input") ) == 2)
        self.email_input().send_keys("test@example.com" + Keys.ENTER)
        self.password_input().send_keys("testpassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)

        create_chat_and_messages(user1, "Greetings", "Hi!", "Hello!")
        create_chat_and_messages(user1, "Question about math", "What is Mathematics?", "Mathematics is...")

        self.open_settings()
        self.delete_chats_button().click()
        self.wait_until(lambda _: self.driver.switch_to.alert)
        self.driver.switch_to.alert.accept()

        self.wait_until(lambda _: Chat.objects.count() == 0)
        self.wait_until(lambda _: Message.objects.count() == 0)

        create_chat_and_messages(user1, "Greetings", "Hi!", "Hello!")
        create_chat_and_messages(user1, "Question about math", "What is Mathematics?", "Mathematics is...")

        self.open_settings()
        self.logout_button().click()
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/login")

        user2 = create_user("someone@example.com", "somepassword")
        self.driver.get(f"{self.live_server_url}/login")
        self.wait_until(lambda _: len(self.driver.find_elements(By.TAG_NAME, "input") ) == 2)
        self.email_input().send_keys("someone@example.com" + Keys.ENTER)
        self.password_input().send_keys("somepassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)

        create_chat_and_messages(user2, "A question about Algebra", "Tell me what is Geometry.", "Sure. Geometry is...")
        create_chat_and_messages(user2, "Python question", "What is the 'def' keyword in Python?", "The 'def' keyword is used for...")

        self.open_settings()
        self.delete_chats_button().click()        
        self.wait_until(lambda _: self.driver.switch_to.alert)
        self.driver.switch_to.alert.accept()

        self.wait_until(lambda _: Chat.objects.count(), 2)
        self.wait_until(lambda _: Message.objects.count(), 4)

        self.assertEqual(Chat.objects.all()[0].user, user1)
        self.assertEqual(Chat.objects.all()[0].title, "Greetings")
        self.assertEqual(Chat.objects.all()[1].user, user1)
        self.assertEqual(Chat.objects.all()[1].title, "Question about math")

    def email_input(self):
        return self.driver.find_element(By.ID, "email-input")

    def password_input(self):
        return self.driver.find_element(By.ID, "password-input")

    def open_search_button(self):
        return self.driver.find_element(By.ID, "open-search-button")

    def search_input(self):
        return self.driver.find_element(By.ID, "search-input")

    def search_entries_div(self):
        return self.driver.find_element(By.ID, "search-entries-div")

    def search_entry_as(self):
        return self.driver.find_elements(By.CLASS_NAME, "search-entry-a")

    def open_settings_button(self):
        return self.driver.find_element(By.ID, "open-settings-button")

    def logout_button(self):
        return self.driver.find_element(By.ID, "logout-button")

    def close_settings_button(self):
        return self.driver.find_element(By.ID, "close-settings-button")

    def theme_select(self):
        return self.driver.find_element(By.ID, "theme-select")

    def delete_chats_button(self):
        return self.driver.find_element(By.ID, "delete-chats-button")

    def delete_account_button(self):
        return self.driver.find_element(By.ID, "delete-account-button")

    def logout_button(self):
        return self.driver.find_element(By.ID, "logout-button")

    def open_settings(self):
        self.open_settings_button().click()
        self.wait_until(lambda _: len(self.driver.find_elements(By.ID, "settings-p")) == 1)

    def close_settings(self):
        self.close_settings_button().click()
        self.wait_until(lambda _: len(self.driver.find_elements(By.ID, "settings-p")) == 0)

    def body(self):
        return self.driver.find_element(By.TAG_NAME, "body")

    def wait_until(self, method, timeout: float = 1.0):
        WebDriverWait(self.driver, timeout).until(method)

class SeleniumChannelsTests(ChannelsLiveServerTestCase):
    def setUp(self):
        self.driver = webdriver.Edge()

    def tearDown(self):
        self.driver.quit()

    def test_index(self):
        user_message1 = "Hi!"
        bot_message1 = "Hello! How can I help you today?"
        user_message2 = "Write a \"Hello World!\" (without a comma) Python program. Just write the code."
        bot_message2 = "print(\"Hello World!\")"

        create_user()

        self.driver.get(f"{self.live_server_url}")
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/login")

        self.email_input().send_keys("test@example.com" + Keys.ENTER)
        self.password_input().send_keys("testpassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)
        time.sleep(0.5)

        self.prompt_text_area().send_keys(user_message1 + Keys.ENTER)
        self.wait_until(lambda _: self.user_message_divs()[0].text == user_message1)

        self.assertEqual(Chat.objects.count(), 1)
        self.assertEqual(Chat.objects.first().title, "Chat 1")
        self.wait_until(lambda _: Message.objects.count() == 2, 5)
        self.assertEqual(Message.objects.first().text, user_message1)
        self.assertTrue(Message.objects.first().is_user_message)
        self.assertFalse(Message.objects.last().is_user_message)

        self.wait_until(lambda _: self.bot_message_divs()[0].text == bot_message1, 25)
        self.assertEqual(self.bot_message_divs()[0].get_attribute("innerHTML"), f"<p>{bot_message1}</p>")
        self.assertIn("/chat/", self.driver.current_url)
        self.wait_until(lambda _: Message.objects.last().text == bot_message1)

        self.prompt_text_area().send_keys(user_message2 + Keys.ENTER)
        self.wait_until(lambda _: self.user_message_divs()[1].text == user_message2)

        self.wait_until(lambda _: Message.objects.count() == 4, 5)
        self.assertEqual(Message.objects.all()[2].text, user_message2)
        self.assertTrue(Message.objects.all()[2].is_user_message)
        self.assertFalse(Message.objects.all()[3].is_user_message)

        self.wait_until(lambda _: self.bot_message_divs()[1].text == bot_message2, 10)
        self.assertEqual(self.bot_message_divs()[1].get_attribute("innerHTML"), '<div class="codehilite" data-language="python"><pre><span></span><code><span class="nb">print</span><span class="p">(</span><span class="s2">"Hello World!"</span><span class="p">)</span>\n</code></pre></div>')
        self.assertEqual(Message.objects.last().text, f"```python\n{bot_message2}\n```")

    def test_index_history_panel(self):
        user_message1 = "Type only one word"
        bot_message1 = "\"Awesome\""
        user_message2 = "Say a very small phrase"
        bot_message2 = "\"I'm here to help you with your writing needs.\""

        create_user()

        self.driver.get(f"{self.live_server_url}/login")
        self.wait_until(lambda _: len(self.driver.find_elements(By.TAG_NAME, "input")) > 0)
        self.email_input().send_keys("test@example.com" + Keys.ENTER)
        self.password_input().send_keys("testpassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)
        time.sleep(0.5)

        self.prompt_text_area().send_keys(user_message1 + Keys.ENTER)
        self.assertEqual(self.user_message_divs()[0].text, user_message1)
        self.wait_until(lambda _: self.bot_message_divs()[0].text == bot_message1, 60)

        self.assertEqual(len(self.past_chat_as()), 1)
        self.assertEqual(self.past_chat_as()[0].text, "Chat 1")
        self.assertIn(f"/chat/{Chat.objects.all()[0].uuid}", self.past_chat_as()[0].get_attribute("href"))

        self.driver.get(self.live_server_url)
        time.sleep(0.5)

        self.prompt_text_area().send_keys(user_message2 + Keys.ENTER)
        self.assertEqual(self.user_message_divs()[0].text, user_message2)
        self.wait_until(lambda _: self.bot_message_divs()[0].text == bot_message2, 10)

        self.assertEqual(len(self.past_chat_as()), 2)
        self.assertEqual(self.past_chat_as()[1].text, "Chat 2")
        self.assertIn(f"/chat/{Chat.objects.all()[1].uuid}", self.past_chat_as()[1].get_attribute("href"))

    def test_index_buttons(self):
        create_user()

        self.driver.get(f"{self.live_server_url}/login")
        self.wait_until(lambda _: len(self.driver.find_elements(By.TAG_NAME, "input")) > 0)
        self.email_input().send_keys("test@example.com" + Keys.ENTER)
        self.password_input().send_keys("testpassword" + Keys.ENTER)
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/", 3)

        local_storage = self.driver.execute_script("return {...localStorage}")
        self.assertEqual(local_storage["isSidebarVisible"], "true")
        self.assertEqual(local_storage["theme"], "system")

        self.toggle_sidebar_button().click()

        local_storage = self.driver.execute_script("return {...localStorage}")
        self.assertEqual(local_storage["isSidebarVisible"], "false")

        self.open_search_button().click()
        self.assertIn("Search here...", self.driver.find_element(By.ID, "search-div").get_attribute("innerHTML"))
        self.body().send_keys(Keys.ESCAPE)

        self.prompt_text_area().send_keys("Type only one word" + Keys.ENTER)
        self.wait_until(lambda _: self.user_message_divs()[0].text == "Type only one word")

        self.wait_until(lambda _: "/chat/" in self.driver.current_url, 15)

        self.new_chat_a().click()
        self.wait_until(lambda _: self.driver.current_url == f"{self.live_server_url}/")

    def email_input(self):
        return self.driver.find_element(By.ID, "email-input")

    def password_input(self):
        return self.driver.find_element(By.ID, "password-input")

    def prompt_text_area(self):
        return self.driver.find_element(By.ID, "prompt-textarea")

    def user_message_divs(self):
        return self.driver.find_elements(By.CLASS_NAME, "user-message-div")

    def bot_message_divs(self):
        return self.driver.find_elements(By.CLASS_NAME, "bot-message-div")

    def past_chat_as(self):
        return self.driver.find_elements(By.CLASS_NAME, "past-chat-a")

    def toggle_sidebar_button(self):
        return self.driver.find_element(By.ID, "toggle-sidebar-button")

    def open_search_button(self):
        return self.driver.find_element(By.ID, "open-search-button")

    def new_chat_a(self):
        return self.driver.find_element(By.ID, "new-chat-a")

    def body(self):
        return self.driver.find_element(By.TAG_NAME, "body")

    def wait_until(self, method, timeout: float = 1.0):
        WebDriverWait(self.driver, timeout).until(method)

def create_user(email: str = "test@example.com", password: str = "testpassword") -> User:
    return User.objects.create_user(email = email, password = password)