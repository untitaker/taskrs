export PATH := ./node_modules/.bin/:$(PATH)

all: install build

install: install-npm install-bower

install-bower:
	bower install \
		bootstrap \
		bootswatch

install-npm:
	npm install

build-js:
	mkdir -p build/js
	webpack js/app.js build/js/all.js

build-css:
	mkdir -p build/css build/fonts
	cp -R bower_components/bootstrap/dist/fonts/* build/fonts/
	lessc css/app.less | grep -v removethisline > build/css/all.css

build-html:
	mkdir -p build
	cp -R site/{*,.htaccess} build/

build: build-js build-css build-html
	cd build && ( \
		echo "CACHE MANIFEST"; \
		echo "# Build: `date`"; \
		echo "CACHE:"; \
		find js css fonts -type f; \
		echo "NETWORK:"; \
		echo '*'; \
	) > cache.manifest

lint:
	eslint js/

serve:
	cd build && python3 -mhttp.server

autobuild:
	while inotifywait \
		-e create -e delete -e move \
		--include='.(tsx|css)' \
		-r .; do \
		make -j build; \
	done

deploy:
	set -ex; \
		cd build/; \
		rm -rf .git; \
		git init; \
		git remote add 5apps git@5apps.com:untitaker_taskrs.git; \
		git add -A; \
		git commit -am "$$(date)"; \
		git push -f 5apps master

clean:
	rm -r build/ bower_components/ node_modules/

sh:
	$$SHELL

# We don't have to provide all phony targets here since only build exists in the FS.
.PHONY: build
