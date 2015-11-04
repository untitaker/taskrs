export PATH := ./node_modules/.bin/:$(PATH)

install: install-npm install-bower

install-bower:
	bower install \
		ical.js \
		react \
		remotestorage \
		bootstrap \
		bootswatch \
		moment \
		autosize \
		Autolinker.js

install-npm:
	npm install bower less eslint commonmark

build-js:
	mkdir -p build/js
	cat \
		bower_components/remotestorage/remotestorage.js \
		bower_components/ical.js/build/ical.js \
		bower_components/react/react.js \
		bower_components/moment/moment.js \
		bower_components/autosize/dist/autosize.js \
		node_modules/commonmark/dist/commonmark.min.js \
		bower_components/Autolinker.js/dist/Autolinker.js \
		js/utils.js \
		js/model.js \
		js/app.js \
		> build/js/all.js

build-css:
	mkdir -p build/css build/fonts
	cp -R bower_components/bootstrap/dist/fonts/* build/fonts/
	lessc css/app.less | grep -v removethisline > build/css/all.css

build-html:
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

# We don't have to provide all phony targets here since only build exists in the FS.
.PHONY: build
