install:
	bower install ical.js react remotestorage bootstrap moment


build-js:
	mkdir -p build/js
	cat \
		bower_components/remotestorage/remotestorage.js \
		bower_components/ical.js/build/ical.js \
		bower_components/react/react.js \
		bower_components/moment/moment.js \
		js/utils.js \
		js/model.js \
		js/app.js \
		> build/js/all.js

build-css:
	mkdir -p build/css build/fonts
	cp -R bower_components/bootstrap/dist/fonts/* build/fonts/
	cat bower_components/bootstrap/dist/css/bootstrap.css css/app.css > build/css/all.css

build-html:
	cp -R site/{*,.htaccess} build/

build: build-js build-css build-html
	cd build && ( \
		echo "CACHE MANIFEST"; \
		echo "# Build: `date`"; \
		echo "CACHE:"; \
		echo "index.html"; \
		find js css fonts -type f; \
		echo "NETWORK:"; \
		echo '*'; \
	) > cache.manifest

lint:
	jshint js/*.js

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
	rsync -av --delete --chmod=755 ./build/ untispace:~/virtual/unterwaditzer.net/taskrs/

clean:
	rm -r build/

# We don't have to provide all phony targets here since only build exists in the FS.
.PHONY: build
