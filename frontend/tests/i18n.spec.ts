import { expect, test } from "@playwright/test"

const locales = [{
    locale: "en-US",
    expected: {
        loginHeader: "Welcome back",
        loginAnchor: "Log in!",
        signupHeader: "Create your account",
        signupAnchor: "Sign up!"
    }
}, {
    locale: "pt-BR",
    expected: {
        loginHeader: "Bem-vindo de volta",
        loginAnchor: "Entrar!",
        signupHeader: "Crie sua conta",
        signupAnchor: "Cadastre-se"
    }
}]

for (const { locale, expected } of locales) {
    test.describe(`language detection - ${locale}`, () => {
        test.use({ locale })

        test(`shows correct signup texts for ${locale}`, async ({ page }) => {
            await page.goto("/signup")

            await expect(page.getByRole("heading", { name: expected.signupHeader })).toBeVisible()

            await page.click(`text=${expected.loginAnchor}`)
            await expect(page.getByRole("heading", { name: expected.loginHeader })).toBeVisible()
        })

        test(`shows correct login texts for ${locale}`, async ({ page }) => {
            await page.goto("/login")

            await expect(page.getByRole("heading", { name: expected.loginHeader })).toBeVisible()

            await page.click(`text=${expected.signupAnchor}`)
            await expect(page.getByRole("heading", { name: expected.signupHeader })).toBeVisible()
        })
    })
}