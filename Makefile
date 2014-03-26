UI = bdd
REPORTER = dot
REQUIRE = --require specs/helper.js
SPECS = specs/**/*.spec.js
BIN = ./node_modules/.bin/mocha
LINT = ./node_modules/.bin/jshint
WATCH =

all: lint specs build

build:
	# Building
	@gulp scripts

lint:
	# Linting
	# $(LINT) public/ specs/ Gulpfile.js
	@grunt lint

specs:
	# Specs
	@$(BIN) --ui $(UI) --reporter $(REPORTER) $(REQUIRE) $(WATCH) $(SPECS)

watch:
	make specs REPORTER=spec WATCH=--watch

coverage:
	@jscoverage --no-highlight public public-coverage
	@TEST_COV=1 make specs REPORTER=html-cov > coverage.html
	@rm -rf public-coverage

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

.PHONY: specs coverage lint
