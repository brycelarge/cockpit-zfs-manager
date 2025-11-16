PACKAGE := cockpit-zfs-manager
VERSION := 0.1.0
NAME := zfs-manager

# Check if we're on macOS (no /usr/share/cockpit)
ifeq ($(shell test -d /usr/share/cockpit && echo "yes"),yes)
    include /usr/share/cockpit/Makefile.common
endif

# Install target
install:
	mkdir -p $(DESTDIR)/usr/share/cockpit/$(NAME)
	cp -r zfs-manager/* $(DESTDIR)/usr/share/cockpit/$(NAME)/

# Development install (Linux only)
devel-install:
	@if [ ! -d ~/.local/share/cockpit ]; then \
		mkdir -p ~/.local/share/cockpit; \
	fi
	ln -sf `pwd`/zfs-manager ~/.local/share/cockpit/$(NAME)

devel-uninstall:
	rm -f ~/.local/share/cockpit/$(NAME)

.PHONY: install devel-install devel-uninstall
