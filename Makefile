UI = bdd
REPORTER = dot
REQUIRE = --require tests/helper.js
RUNNER = ./node_modules/.bin/_mocha
DEBUGGER = node --debug ./node_modules/.bin/_mocha
LINT = ./node_modules/.bin/jshint
WATCH =
TESTS = $(shell find tests -name "*.spec.js")
KARMA = ./node_modules/karma/bin/karma
GULP = ./node_modules/gulp/bin/gulp.js
GRUNT = ./node_modules/grunt-cli/bin/grunt
ISTANBUL = ./node_modules/istanbul/lib/cli.js

red=`tput setaf 1`
normal=`tput sgr0`

all: lint test build

install:
	@npm install --loglevel error

build: lint test
	@$(GULP) scripts

lint:
	@$(GRUNT) lint

test:
	@NODE_PATH=$(shell pwd)/public $(RUNNER) --ui $(UI) --reporter $(REPORTER) $(REQUIRE) $(WATCH) $(TESTS)

watch-node:
	@make test REPORTER=spec WATCH=--watch

debug:
	@echo "Start ${red}node-inspector${normal} if not running already"
	@make test WATCH=--watch RUNNER="$(DEBUGGER)"

watch:
	@$(GULP) tests watch

coverage:
	@NODE_PATH=$(shell pwd)/public $(ISTANBUL) cover $(RUNNER) $(REQUIRE) $(TESTS)

publish:
	@make test && npm publish && make tag

tag:
	@git tag "v$(shell node -e "var config = require('./package.json'); console.log(config.version);")"
	@git push --tags

site: clean build coverage
	@git clone .git build
	@cd build && git checkout gh-pages && cd ..

	# Copying distibutable JS
	@cp dist/*.js build/dist/

	# Copying coverage reports
	cp -rf coverage/* build/coverage/

	# Updating gh-pages
	@cd build && git add . && git commit -am "update-$(shell date -u | tr ' ' '_')"
	@cd build && git push origin gh-pages && cd ..
	#git push origin gh-pages

clean:
	@rm -f build/*.js

karma:
	@$(GULP) tests
	@$(KARMA) start karma/conf.js

server:
	@$(GULP) tests watch server

start: install server

documentation:
	rm -rf ./docs/*
	./node_modules/.bin/jsdoc -c ./jsdoc.conf.json

.PHONY: coverage build karma
