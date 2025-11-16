# Cockpit ZFS Manager

A modern Cockpit plugin for managing ZFS pools, datasets, and snapshots. Built with vanilla JavaScript (no jQuery) and PatternFly 6 styling. Compatible with Cockpit 201+.

## Requirements

- **Cockpit**: 201+ (installed and running)
- **ZFS**: 0.8+ with zpool and zfs commands available
- **Permissions**: Root or sudo access for ZFS operations

## Installation

### Simple Install

1. Clone and build:
   ```bash
   git clone https://github.com/brycelarge/cockpit-zfs-manager.git
   cd cockpit-zfs-manager
   npm install
   make
   ```

2. Install:
   ```bash
   sudo make install
   ```

   Or manually copy:
   ```bash
   sudo cp -r dist /usr/share/cockpit/zfs-manager
   ```

3. Restart Cockpit (if needed):
   ```bash
   sudo systemctl restart cockpit
   ```

Done! The plugin will appear in Cockpit's sidebar.

### Remote Server Install

On your server:
```bash
git clone https://github.com/brycelarge/cockpit-zfs-manager.git
cd cockpit-zfs-manager
npm install
make
sudo make install
sudo systemctl restart cockpit
```

Or copy from your local machine:
```bash
make
scp -r dist user@server:/tmp/
ssh user@server "sudo cp -r /tmp/dist /usr/share/cockpit/zfs-manager"
```

## Usage

1. **Access Cockpit**: Open your Cockpit web interface (typically `https://your-server:9090`)

2. **Login**: Authenticate with a user that has ZFS permissions

3. **Open ZFS Manager**: Click on "ZFS Manager" in the Cockpit sidebar

4. **Manage ZFS**:
   - View all storage pools with health status and usage statistics
   - Expand pools to see file systems, snapshots, and detailed status
   - Create new pools with various VDEV configurations (stripe, mirror, RAID-Z variants)
   - Create file systems and snapshots
   - Manage encryption and unlock encrypted datasets
   - Clone file systems and snapshots
   - Rollback to snapshots
   - Export and destroy pools (with appropriate warnings)

## Features

### Storage Pool Management
- List all ZFS pools with health status
- View pool statistics (size, allocated, free, fragmentation, usage)
- Create new storage pools with VDEV types:
  - Stripe (no redundancy)
  - Mirror (2+ devices)
  - RAID-Z (single parity)
  - RAID-Z2 (double parity)
  - RAID-Z3 (triple parity)
- Import existing pools
- Export pools
- Destroy pools (with confirmation)
- View detailed pool status

### File System Management
- List all file systems within pools
- Create new file systems
- Support for encrypted file systems with passphrase
- Clone file systems
- Destroy file systems

### Snapshot Management
- List all snapshots
- Create snapshots
- Clone snapshots to new file systems
- Rollback to snapshots
- Destroy snapshots

### Encryption Support
- Create encrypted file systems
- Unlock encrypted file systems with passphrase
- Visual indicators for encrypted datasets

### User Interface
- Modern PatternFly 6 design
- Expandable table rows for detailed views
- Tabbed interface (File Systems, Snapshots, Status)
- Toast notifications for actions
- Responsive design

## Uninstallation

Remove the plugin directory:

```bash
sudo rm -rf /usr/share/cockpit/zfs-manager
```

Restart Cockpit:

```bash
sudo systemctl restart cockpit
```

For development installs:

```bash
make devel-uninstall
```

## Troubleshooting

### Plugin not appearing in Cockpit
- Verify installation: `ls -la /usr/share/cockpit/zfs-manager`
- Check Cockpit logs: `journalctl -u cockpit`
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Ensure you have proper permissions

### ZFS commands not found
- Install ZFS utilities:
  - Debian/Ubuntu: `sudo apt install zfsutils-linux`
  - Fedora/RHEL: `sudo dnf install zfs`
- Verify installation: `which zpool && which zfs`

### Permission errors
- Ensure your user has sudo access for ZFS commands
- Check polkit rules if using policy-based access control
- Some operations require root privileges

## Development

For developers who want to contribute or modify the plugin:

### Prerequisites
- Node.js 20+ and npm (use `nvm` to install: `nvm install` then `nvm use`)
- Make

On Debian/Ubuntu:
```bash
sudo apt install gettext nodejs npm make
```

On Fedora:
```bash
sudo dnf install gettext nodejs npm make
```

### Building

Build the plugin (compiles SCSS and copies files to `dist/`):
```bash
npm install
make
```

Or use watch mode for automatic rebuilds:
```bash
make watch
```

### Development Installation (Linux)
```bash
make devel-install
```

This creates a symlink at `~/.local/share/cockpit/zfs-manager` pointing to `dist/` for local development.

After changing code, run `make` again and reload the Cockpit page in your browser.

### Code Quality

Run linting:
```bash
npm run eslint
npm run stylelint
```

Fix auto-fixable issues:
```bash
npm run eslint:fix
npm run stylelint:fix
```


## License

LGPL-2.1

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Acknowledgments

This plugin is inspired by the [45Drives cockpit-zfs-manager](https://github.com/45Drives/cockpit-zfs-manager) project, but rebuilt from scratch with modern JavaScript (no jQuery) and PatternFly 6 styling.
