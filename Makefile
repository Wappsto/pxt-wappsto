all: test

build:
	pxt build

deploy:
	pxt deploy

test:
	pxt test

clean:
	pxt clean

install: update
update:
	npm install pxt
	pxt target microbit
	#pxt target calliopemini
	pxt install
