# Kavita JS Tweaks
Kavita Tweaks / Features via injected JS

## Current Features

* Dismissable MOTD (Message of the Day), supports HTML (shows once per user per device, until it's updated again)

* Add custom links to the user profile menu (for chat servers, request forms, etc)

## Requirements

This was tested with Nginx reverse proxy in front of the Dockerized install. It should work with other setups, but may require some changes.

## Setup

1. Get your installId from Settings > Info > System

2. Download  `kavita-custom-tweaks.js`, and open to edit.

3. Download `kavita-encrypt-secrets.html` and run locally, using your installId as the password.

4. Generate replacement strings for (ENCRYPTED) https://github.com/duplaja/kavita-js-tweaks/blob/17d1029205a624a8295445b8ab737b66b36c41ca/kavita-custom-tweaks.js#L6

5. Put somewhere accessible to your webserver.

6. Add the following to the relevant parts of your Nginx server block (can adjust for other setups):

   ```nginx
   location = /kavita-custom-tweaks.js {
            alias /path/to/your/file/kavita-custom-tweaks.js;
        }

        location / {

            sub_filter '</head>'
               '</head><script src="/kavita-custom-tweaks.js"></script>';
            sub_filter_once on;

            proxy_set_header Accept-Encoding "";
    ```

   7. Restart nginx

  ## Notes

  * Once dismissed, the MOTD will stay hidden until the motd id is updated. (this is, once, per device, per user, until dismissed).
