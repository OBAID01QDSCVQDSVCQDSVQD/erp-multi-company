---
description: Deploy the application to Fly.io
---

To deploy the application to Fly.io, follow these steps:

1.  **Login to Fly.io** (if you haven't already):
    ```powershell
    fly auth login
    ```

2.  **Deploy the application**:
    This command will build the Docker image and deploy it to Fly.io based on the configuration in `fly.toml`.
    ```powershell
    fly deploy
    ```

3.  **Monitor the deployment**:
    You can check the status of your application with:
    ```powershell
    fly status
    ```

4.  **Open the application**:
    Once deployed, you can open it in your browser:
    ```powershell
    fly open
    ```
