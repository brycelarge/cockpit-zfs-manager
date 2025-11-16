PACKAGE := cockpit-zfs-manager
VERSION := 0.1.0
NAME := zfs-manager

# Check if we're on macOS (no /usr/share/cockpit)
ifeq ($(shell test -d /usr/share/cockpit && echo "yes"),yes)
    include /usr/share/cockpit/Makefile.common
endif

# Build the plugin
dist: src/manifest.json src/index.html src/zfs-manager.js src/zfs-manager.scss
	@echo "Building plugin..."
	@./build.js
	@echo "Build complete! Output in dist/"

# Install target
install: dist
	mkdir -p $(DESTDIR)/usr/share/cockpit/$(NAME)
	cp -r dist/* $(DESTDIR)/usr/share/cockpit/$(NAME)/

# Development install (Linux only)
devel-install: dist
	@if [ ! -d ~/.local/share/cockpit ]; then \
		mkdir -p ~/.local/share/cockpit; \
	fi
	ln -sf `pwd`/dist ~/.local/share/cockpit/$(NAME)

devel-uninstall:
	rm -f ~/.local/share/cockpit/$(NAME)

# Watch mode
watch:
	./build.js -w

.PHONY: install devel-install devel-uninstall watch dist
