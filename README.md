# innov-stocker.node

# Rebuild l'image
docker build -t innov-stocker-app .

# Lancer le container avec varibales .env
 docker run --rm --env-file .env.developmen -p 8000:8000 innov-stocker-app

# Starting redis server

sudo service redis-server start
sudo ss -tuln | grep :3000
docker ps -q | xargs -r docker kill
docker ps -q | xargs -r docker stop
sudo ss -tuln

Remove-Item -Recurse -Force node_modules, package-lock.json; npm install

- 📦innov-stocker.node
- ┣ 📂build
- ┃ ┗ 📂script
- ┃ ┃ ┣ 📜deploy.sh
- ┃ ┃ ┣ 📜start.sh
- ┃ ┃ ┣ 📜stop.sh
- ┃ ┃ ┗ 📜test.sh
- ┣ 📂src
- ┃ ┣ 📂api
- ┃ ┃ ┗ 📜index.ts
- ┃ ┣ 📂common
- ┃ ┃ ┣ 📂errors
- ┃ ┃ ┃ ┗ 📜httpErrors.ts
- ┃ ┃ ┣ 📂middleware
- ┃ ┃ ┃ ┣ 📜authentication.ts
- ┃ ┃ ┃ ┣ 📜errorHandler.ts
- ┃ ┃ ┃ ┣ 📜JSend.ts
- ┃ ┃ ┃ ┣ 📜queryParssing.ts
- ┃ ┃ ┃ ┗ 📜token.ts
- ┃ ┣ 📂models
- ┃ ┃ ┗ 📜Model.ts
- ┃ ┣ 📂routing
- ┃ ┃ ┣ 📜BaseRouter.ts
- ┃ ┃ ┣ 📜decorators.ts
- ┃ ┃ ┣ 📜metadata.storage.ts
- ┃ ┃ ┗ 📜register.ts
- ┃ ┣ 📂types
- ┃ ┃ ┗ 📜index.ts
- ┃ ┗ 📂utils
- ┃ ┃ ┗ 📜index.ts
- ┣ 📂config
- ┃ ┣ 📜http.ts
- ┃ ┗ 📜index.ts
- ┣ 📂database
- ┃ ┣ 📂migrations
- ┃ ┃ ┗ 📜1745082102282-$npm_config_name.ts
- ┃ ┗ 📜data-source.ts
- ┣ 📂lib
- ┃ ┣ 📂openapi-schemas
- ┃ ┃ ┣ 📜auth.schemas.ts
- ┃ ┃ ┗ 📜user.schemas.ts
- ┃ ┣ 📜logger.ts
- ┃ ┣ 📜mailer.ts
- ┃ ┣ 📜openapi.ts
- ┃ ┗ 📜redis.ts
- ┣ 📂modules
- ┃ ┣ 📂auth
- ┃ ┃ ┣ 📂models
- ┃ ┃ ┃ ┣ 📜authorization.types.ts
- ┃ ┃ ┃ ┗ 📜features.ts
- ┃ ┃ ┣ 📂services
- ┃ ┃ ┃ ┗ 📜auth.services.ts
- ┃ ┃ ┗ 📜auth.routes.ts
- ┃ ┗ 📂users
- ┃ ┃ ┣ 📂data
- ┃ ┃ ┃ ┗ 📜users.repository.ts
- ┃ ┃ ┣ 📂models
- ┃ ┃ ┃ ┗ 📜users.entity.ts
- ┃ ┃ ┣ 📂services
- ┃ ┃ ┃ ┗ 📜users.services.ts
- ┃ ┃ ┣ 📂**tests**
- ┃ ┃ ┃ ┗ 📜users.spec.ts
- ┃ ┃ ┗ 📜users.routes.ts
- ┣ 📂tests
- ┃ ┣ 📂data
- ┃ ┃ ┣ 📜1-schema.sql
- ┃ ┃ ┗ 📜2-datas.sql
- ┃ ┣ 📜docker-compose.yml
- ┃ ┗ 📜setup.ts
- ┣ 📜app.ts
- ┗ 📜server.ts
- ┣ 📜.dockerignore
- ┣ 📜.env
- ┣ 📜.env.example
- ┣ 📜.env.local
- ┣ 📜.env.test
- ┣ 📜.eslintcache
- ┣ 📜.eslintignore
- ┣ 📜.gitignore
- ┣ 📜.prettierrc.js
- ┣ 📜Dockerfile
- ┣ 📜eslint.config.js
- ┣ 📜package.json
- ┣ 📜README.md
- ┣ 📜tsconfig.json
- ┗ 📜vitest.config.mts
