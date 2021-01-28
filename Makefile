all: test

build:
	pxt build

deploy:
	pxt deploy

test:
	pxt test

clean:
	pxt clean

update:
	npm install pxt
	pxt target microbit
	pxt install
