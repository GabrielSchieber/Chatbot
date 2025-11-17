import { Page, expect } from "@playwright/test"
import { authenticator } from "otplib"

export function apiFetch(url: string, init: RequestInit) {
    return fetch(`http://localhost:8000${url}`, init)
}

export function getRandomEmail() {
    return `user_${crypto.randomUUID()}@example.com`
}

export async function signup() {
    const email = getRandomEmail()
    const password = "testpassword"
    const response = await apiFetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
    expect(response.status).toBe(201)
    return [email, password]
}

export async function signupAndLogin(page: Page, withChats: boolean = false): Promise<User> {
    const [email, password] = await signup()

    await page.goto("/login")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")

    let chats: Chat[] = []
    if (withChats) {
        const response = await apiFetch("/test/create-chats/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, chats: exampleChats })
        })
        expect(response.status).toEqual(200)
        const uuids = await response.json()
        chats = exampleChats.map((c, i) => ({ ...c, uuid: uuids[i] }))
        chats.reverse()
    }

    await page.reload()

    return { email, password, chats }
}

export async function signupWithMFAEnabledAndLogin(page: Page) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])

    const user = await signupAndLogin(page)

    await page.getByTestId("open-settings").click()
    await page.getByRole("tab", { name: "Security" }).click()

    await page.getByText("Multi-factor authentication", { exact: true }).locator("..").getByRole("button").click()
    await expect(page.getByText("Step 1: Setup", { exact: true })).toBeVisible()

    await page.getByText("Generate QR and secret codes", { exact: true }).click()
    await expect(page.getByText("Step 2: Verify", { exact: true })).toBeVisible()

    const secretText = await page.getByText(/Secret:/).textContent()
    const secret = secretText?.split("Secret:")[1].trim()!

    const code = authenticator.generate(secret)

    await page.getByPlaceholder("6-digit code", { exact: true }).fill(code)
    await page.getByRole("button", { name: "Enable", exact: true }).click()

    await expect(page.getByText("Enabling", { exact: true })).toBeVisible()
    await expect(page.getByText("Step 3: Backup", { exact: true })).toBeVisible({ timeout: 15000 })

    await page.getByRole("list").getByRole("button").first().click()

    const clipboard = await page.evaluate(_ => navigator.clipboard.readText())
    expect(clipboard.length).toEqual(6 * 2 * 10 + 9)

    const backupCodes = clipboard.split("\n")
    expect(backupCodes.length).toEqual(10)

    await page.getByText("I have backed up the codes.", { exact: true }).click()
    await page.getByRole("button", { name: "Close", exact: true }).click()

    await page.reload()

    return { user, backupCodes }
}

export async function signupWithMFAEnabled(page: Page) {
    const user = await signupWithMFAEnabledAndLogin(page)

    await page.getByTestId("open-settings").click()
    await page.getByRole("tab", { name: "Security" }).click()
    await page.getByRole("button", { name: "Log out", exact: true }).click()
    await page.waitForURL("/login")

    return user
}

export type User = {
    email: string
    password: string
    chats: Chat[]
}

export type Chat = {
    uuid: string
    title: string
    messages: Message[]
}

export type Message = {
    text: string
    is_from_user: boolean
}

const exampleChats: { title: string, messages: Message[] }[] = [
    {
        title: "Greetings",
        messages: [
            {
                text: "Hello!",
                is_from_user: true
            },
            {
                text: "Hello! How are you?",
                is_from_user: false
            }
        ]
    },
    {
        title: "Weather Inquiry",
        messages: [
            {
                text: "What's the weather like today?",
                is_from_user: true
            },
            {
                text: "It's sunny with a high of 28°C.",
                is_from_user: false
            }
        ]
    },
    {
        title: "Joke Request",
        messages: [
            {
                text: "Tell me a joke.",
                is_from_user: true
            },
            {
                text: "Why don’t skeletons fight each other? They don’t have the guts.",
                is_from_user: false
            }
        ]
    },
    {
        title: "Math Help",
        messages: [
            {
                text: "Can you solve 12 * 8?",
                is_from_user: true
            },
            {
                text: "Sure! 12 times 8 is 96.",
                is_from_user: false
            }
        ]
    },
    {
        title: "Travel Advice",
        messages: [
            {
                text: "What's the best time to visit Japan?",
                is_from_user: true
            },
            {
                text: "Spring and autumn are ideal for pleasant weather and beautiful scenery.",
                is_from_user: false
            },
            {
                text: "Thanks! I'll plan for April.",
                is_from_user: true
            },
            {
                text: "Great choice! Cherry blossoms are stunning that time of year.",
                is_from_user: false
            }
        ]
    },
    {
        title: "Recipe Suggestion",
        messages: [
            {
                text: "I have eggs and spinach. What can I make?",
                is_from_user: true
            },
            {
                text: "You could make a spinach omelette. Want the recipe?",
                is_from_user: false
            },
            {
                text: "Yes, please.",
                is_from_user: true
            },
            {
                text: "Beat eggs, sauté spinach, then cook together in a pan. Simple and tasty!",
                is_from_user: false
            }
        ]
    },
    {
        title: "Motivation",
        messages: [
            {
                text: "I'm feeling unmotivated.",
                is_from_user: true
            },
            {
                text: "Remember why you started, and take one small step forward today.",
                is_from_user: false
            }
        ]
    },
    {
        title: "Book Recommendation",
        messages: [
            {
                text: "Can you recommend a good sci-fi book?",
                is_from_user: true
            },
            {
                text: "Sure! 'Dune' by Frank Herbert is a classic with rich world-building.",
                is_from_user: false
            }
        ]
    },
    {
        title: "Language Learning",
        messages: [
            {
                text: "How do you say 'thank you' in Japanese?",
                is_from_user: true
            },
            {
                text: "You say 'Arigatou' (ありがとう).",
                is_from_user: false
            },
            {
                text: "And 'good morning'?",
                is_from_user: true
            },
            {
                text: "That's 'Ohayou gozaimasu' (おはようございます).",
                is_from_user: false
            }
        ]
    },
    {
        title: "Tech Support",
        messages: [
            {
                text: "My laptop is running slow. Any tips?",
                is_from_user: true
            },
            {
                text: "Try closing unused programs, clearing temporary files, and restarting.",
                is_from_user: false
            },
            {
                text: "Okay, I'll try that now.",
                is_from_user: true
            },
            {
                text: "Let me know if it helps or if you need more advanced troubleshooting.",
                is_from_user: false
            }
        ]
    },
    {
        title: "Paragraph About Math",
        messages: [
            {
                text: "What is math? Describe it in a short paragraph.",
                is_from_user: true
            },
            {
                text: "Math is the study of numbers and their operations, which can be expressed using symbols such as 1 for one, 2 for two, or 3 for three. It involves mathematical concepts like addition, subtraction, multiplication, division, and more, often with algebraic expressions to represent these operations mathematically. The core idea behind math lies in understanding patterns, relationships, and structures within numbers, which are essential in various aspects of life, from arithmetic and algebra to geometry and calculus.",
                is_from_user: false
            }
        ]
    },
    {
        title: "Fitness Goals",
        messages: [
            {
                text: "I want to start working out. Any tips?",
                is_from_user: true
            },
            {
                text: "Start with small goals. What’s your main objective—weight loss, strength, or endurance?",
                is_from_user: false
            },
            {
                text: "Mostly weight loss, but I’d like to build some muscle too.",
                is_from_user: true
            },
            {
                text: "Great! Try combining cardio with resistance training. Three days a week is a good start.",
                is_from_user: false
            },
            {
                text: "Should I join a gym or work out at home?",
                is_from_user: true
            },
            {
                text: "Either works! Gyms offer equipment, but home workouts can be effective with bodyweight exercises.",
                is_from_user: false
            },
            {
                text: "Thanks! I’ll start with home workouts.",
                is_from_user: true
            },
            {
                text: "Awesome! Let me know if you want a sample routine.",
                is_from_user: false
            }
        ]
    },
    {
        title: "Job Interview Prep",
        messages: [
            {
                text: "I have a job interview tomorrow. Can you help me prepare?",
                is_from_user: true
            },
            {
                text: "Absolutely! What role is it for?",
                is_from_user: false
            },
            {
                text: "Marketing Manager at a tech startup.",
                is_from_user: true
            },
            {
                text: "Nice! Brush up on digital marketing trends and prepare examples of past campaigns you led.",
                is_from_user: false
            },
            {
                text: "What kind of questions should I expect?",
                is_from_user: true
            },
            {
                text: "Expect behavioral questions like 'Tell me about a time you handled a tight deadline.'",
                is_from_user: false
            },
            {
                text: "Should I ask questions at the end?",
                is_from_user: true
            },
            {
                text: "Definitely. Ask about team structure, growth opportunities, and how success is measured.",
                is_from_user: false
            }
        ]
    },
    {
        title: "Pet Advice",
        messages: [
            {
                text: "I'm thinking of adopting a dog. Any advice?",
                is_from_user: true
            },
            {
                text: "That’s exciting! Do you have a breed or size in mind?",
                is_from_user: false
            },
            {
                text: "I’d prefer a medium-sized dog, something friendly and good with kids.",
                is_from_user: true
            },
            {
                text: "Consider breeds like Labrador Retrievers or Beagles. They’re great family dogs.",
                is_from_user: false
            },
            {
                text: "How much time should I expect to spend on care?",
                is_from_user: true
            },
            {
                text: "Daily walks, feeding, grooming, and playtime—about 1–2 hours a day depending on the dog.",
                is_from_user: false
            },
            {
                text: "What about training?",
                is_from_user: true
            },
            {
                text: "Start with basic commands and positive reinforcement. Puppy classes can be helpful too.",
                is_from_user: false
            },
            {
                text: "Thanks! I’ll look into local shelters.",
                is_from_user: true
            },
            {
                text: "Wonderful! Let me know if you need help choosing or preparing your home.",
                is_from_user: false
            }
        ]
    }
]