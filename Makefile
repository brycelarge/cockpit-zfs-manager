PACKAGE := cockpit-zfs-manager
VERSION := 0.1.0
NAME := zfs-manager
PREFIX ?= /usr

# stamp file to check for node_modules/
NODE_MODULES_TEST=package-lock.json
# one example file in dist/ from bundler to check if that already ran
DIST_TEST=dist/manifest.json

all: $(DIST_TEST)

# Build the plugin
$(DIST_TEST): $(NODE_MODULES_TEST) $(shell find src/ -type f) package.json build.js
	NODE_ENV=$(NODE_ENV) node build.js

watch: $(NODE_MODULES_TEST)
	NODE_ENV=$(NODE_ENV) node build.js --watch

clean:
	rm -rf dist/

install: $(DIST_TEST)
	mkdir -p $(DESTDIR)$(PREFIX)/share/cockpit/$(NAME)
	cp -r dist/* $(DESTDIR)$(PREFIX)/share/cockpit/$(NAME)/

# this requires a built source tree and avoids having to install anything system-wide
devel-install: $(DIST_TEST)
	mkdir -p ~/.local/share/cockpit
	ln -sf `pwd`/dist ~/.local/share/cockpit/$(NAME)

# assumes that there was symlink set up using the above devel-install target,
# and removes it
devel-uninstall:
	rm -f ~/.local/share/cockpit/$(NAME)

$(NODE_MODULES_TEST): package.json
	# unset NODE_ENV, skips devDependencies otherwise
	env -u NODE_ENV npm install

.PHONY: all clean install devel-install devel-uninstall watch
