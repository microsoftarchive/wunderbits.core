UI = bdd
REPORTER = dot
REQUIRE = --require tests/helper.js
TESTS = tests/**/*.spec.js
BIN = ./node_modules/.bin/mocha
LINT = ./node_modules/.bin/jshint
WATCH =

all: lint test build

install:
	@npm install
	@npm install -g gulp grunt

build:
	# Building
	@gulp scripts

lint:
	# $(LINT) public/ specs/ Gulpfile.js
	@grunt lint

test:
	@$(BIN) --ui $(UI) --reporter $(REPORTER) $(REQUIRE) $(WATCH) $(TESTS)

watch:
	make test REPORTER=spec WATCH=--watch

coverage:
	@jscoverage --no-highlight public public-coverage
	@TEST_COV=1 make test REPORTER=html-cov > coverage.html
	@rm -rf public-coverage

publish:
	@make test && npm publish && make tag

tag:
	@git tag "v$(shell node -e "var config = require('./package.json'); console.log(config.version);")"
	@git push --tags

# site: clean build coverage
# 	@git clone .git build
# 	@cd build && git checkout gh-pages && cd ..

# 	# Copying distibutable JS
# 	@cp dist/*.js build/dist/

# 	# Copying coverage reports
# 	cp -rf coverage/* build/coverage/

# 	# Updating gh-pages
# 	@cd build && git add . && git commit -am "update-$(shell date -u | tr ' ' '_')"
# 	@cd build && git push origin gh-pages && cd ..
# 	#git push origin gh-pages

.PHONY: test coverage lint
