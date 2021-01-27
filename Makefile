all: deploy

build:
	pxt build

deploy:
	pxt deploy

test:
	pxt test

update:
	npm install pxt
	pxt target microbit
	pxt install
