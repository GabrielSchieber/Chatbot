# Usage

The app can be used in three different environments: **Development**, **Staging** and **Production**. All of them use Docker, and the **Development** environment also requires VS Code with the Dev Containers extension.

- The **Development** environment is used during development, and the web app is only available locally.
- The **Staging** environment is used for validating the deployment of the app in the **Production** environment while not exposing it to the internet.
- The **Production** environment is used when deploying the app to the general public.

## Get started with the *Development* environment:
  - You need to have the following installed:
    - **Windows** with:
      - **WSL 2** with Ubuntu as the distribution, visit [How to install Linux on Windows with WSL][WSLReference] for more details.

      - **Docker Desktop**, visit [Install Docker Desktop on Windows][DockerReference] for more details.

      - **VS Code** with the **Dev Containers** extension installed:
        - To install VS Code, visit [Setting up Visual Studio Code][VSCodeReference].

        - To set up the Dev Containers extension, visit [Developing inside a Container][DevContainersReference].

  - Open VS Code and do the following:
    - Run the `WSL: Connect to WSL using distro...` command from the Command Palette and choose Ubuntu as the distribution.
    - Create and open a folder inside WSL where you can clone the project.
    - Open a terminal and run the following command:
      ```
      git clone https://github.com/Chatbot
      ```

  - Open the `Chatbot` folder and run the following command from the Command Palette: `Dev Containers: Reopen in container`.

  - Start both the Django and Vite servers by doing one of the following:
    - Using the default build task defined in `.vscode/tasks.json` by doing one of the following:
      - Running the task from the Command Palette: `Tasks: Run Build Task`.
      - Pressing the keyboard shortcut: `Ctrl + Shift + B`.

    - Manually running the servers:
      - Open one terminal with the `backend` folder as its current directory and run:
        ```
        python manage.py runserver
        ```
      - And open another with the `frontend` folder as its current directory and run:
        ```
        npm run dev -- --host
        ```

  - Go to the following URLs in your browser:
    - http://127.0.0.1:8000/admin to access the admin panel.
    - http://localhost:5173 to access the app.

  - From there, you can *gracefully* develop the app inside a containerized and reproducible environment!

  - If you just built the container for the first time, you need to apply the database migrations to make the app fully functional:
    ```
    python backend/manage.py migrate
    ```

## Get started with the *Staging* environment:
  - You need to have the following installed:
    - **Windows** with:
      - **WSL 2** with Ubuntu, visit [How to install Linux on Windows with WSL][WSLReference] for more details.

      - **Docker Desktop**, visit [Install Docker Desktop on Windows][DockerReference] for more details.

  - Clone the project inside WSL:
    ```
    git clone https://github.com/Chatbot
    ```

  - Create mockup SSL certificates:
    - Create a `secrets` folder inside the `Chatbot` folder.
    - Open a WSL terminal with its current directory as the `Chatbot` folder and run the following command:
      ```
      openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout secrets2/private_key.pem -out secrets2/certificate.pem
      ```
      The command will ask you to fill in some fields. For testing, you can leave all of them blank.
  - Build and start the staging container:
    ```
    docker compose -f compose.yaml -f compose.staging.yaml up --build
    ```

  - Go to https://127.0.0.1 in your browser to interact with the app. Note, you may see an "Unsafe connection" warning page since the browser may not trust the mockup SSL certificates by default. If this happens, try to find a button on the notice page that allows you to trust the connection and access the app.

## Get started with the *Production* environment (draft):
  > [!WARNING]
  > The production environment has not yet been fully validated. You may need to change some of the code and check if there are no security issues before publishing the app. The following guide is only a draft and is incomplete.

  - You need to have a Linux virtual machine for the server with Docker Engine and Docker Compose installed.

  - Register a website domain name in [Cloudflare Registrar][CloudflareRegistrarReference] and in Cloudflare's dashboard:
    - [Add your site to Cloudflare.][CloudflareWebsitesReference]
    - [Configure DNS records.][CloudflareDNSReference]
    - [Setup SSL/TLS settings.][CloudflareSSLReference]

  - In your development machine using the Development environment, do the following:
    - Clone the project:
      ```
      git clone https://github.com/Chatbot
      ```

    - Open the `settings.py` file found in the `backend/backend` folder and make the following  changes to these variables:
      - `ALLOWED_HOSTS`: This is the list of domain names your server will be allowed to connect with. If your website domain name is `mywebsite.com`, set this to `["mywebsite.com"]`.

      - `EMAIL_HOST`: The domain name of your SMTP provider, for example, if you're using Gmail, set this to `smtp.gmail.com`.

      - `EMAIL_HOST_USER`: The name of the user of your SMTP provider.

      - `EMAIL_HOST_PASSWORD`: The password for the user of your SMTP provider.

      - `EMAIL_PORT`: The port number of your SMTP provider.

      - Set either `EMAIL_USE_TLS` or `EMAIL_USE_SSL` to `True` depending on whether your SMTP provider uses TLS or SSL for encryption, but not both.

      - `DEFAULT_FROM_EMAIL`: The default from email address that is used by Django when sending emails.

      - `BASE_EMAIL_URL`: Set this to the domain name of your website you want your users to receive emails. If your domain name is `mywebsite.com`, set this to `https://mywebsite.com`.

    - Open the `nginx.production.conf` file found in the `backend` folder and change the `server_name` field for each `server` block to the domain name of your website.

    - Create a `secrets` folder with the following files and their respective contents:
      - `secret_key.txt`: The key used for Django's SECRET_KEY settings variable. You can generate one with the following command:
        ```
        python -c "from django.core.management.utils import get_random_secret_key;print(get_random_secret_key())"
        ```

      - `totp_encryption_key.txt`: The key used for encrypting TOTP secrets. You can generate one with the following command:
        ```
        python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"
        ```
      - `email_host_user.txt`: The name of the user to connect to your SMTP provider.

      - `email_host_password.txt`: The password to use for your SMTP provider.

      - `postgres_db`: The name of the PostgreSQL database you want to use. If you define it as `postgres`, it'll use the default created database that has the same name.

      - `postgres_user`: The name of the user to use when connecting to the database. If you define it as `postgres`, it'll use the default created user that has the same name.

      - `postgres_password`: The password to use when connecting to the database.

      - `certificate.pem`: The SSL certificate used for enabling HTTPS. For more information about how to generate one, visit [Cloudflare origin CA][CloudflareOriginCAReference].

      - `private_key.pem`: The SSL private key used for enabling HTTPS. For more information about how to generate one, visit [Cloudflare origin CA][CloudflareOriginCAReference].

      - `tunnel_token`: The token used for authenticating your server's connection with Cloudflare's network. To create one, visit [Cloudflare's documentation][CloudflareTunnelReference].

  - Clone the modified project to your server.

  - Deploy the app with the following command:
    ```
    docker compose -f compose.yaml -f compose.production.yaml up --build
    ```

[WSLReference]: https://learn.microsoft.com/en-us/windows/wsl/install
[DockerReference]: https://docs.docker.com/desktop/setup/install/windows-install
[VSCodeReference]: https://code.visualstudio.com/docs/setup/setup-overview
[DevContainersReference]: https://code.visualstudio.com/docs/devcontainers/containers
[CloudflareRegistrarReference]: https://developers.cloudflare.com/registrar/get-started/register-domain/
[CloudflareWebsitesReference]: https://developers.cloudflare.com/learning-paths/clientless-access/initial-setup/add-site/
[CloudflareDNSReference]: https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/
[CloudflareSSLReference]: https://developers.cloudflare.com/ssl/get-started/
[CloudflareOriginCAReference]: https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/
[CloudflareTunnelReference]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/