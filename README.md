# Cockpit ZFS Manager

A modern Cockpit plugin for managing ZFS pools, datasets, and snapshots. Built with vanilla JavaScript and PatternFly 6 styling.

## Requirements

- **Cockpit**: 201+ (installed and running)
- **ZFS**: 0.8+ with zpool and zfs commands available
- **Permissions**: Root or sudo access for ZFS operations

## Installation

### Simple Install

1. Clone the repository:
   ```bash
   git clone https://github.com/brycelarge/cockpit-zfs-manager.git
   cd cockpit-zfs-manager
   ```

2. Copy the plugin directory:
   ```bash
   sudo cp -r zfs-manager /usr/share/cockpit/
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
sudo cp -r zfs-manager /usr/share/cockpit/
sudo systemctl restart cockpit
```

Or copy from your local machine:
```bash
scp -r zfs-manager user@server:/tmp/
ssh user@server "sudo cp -r /tmp/zfs-manager /usr/share/cockpit/"
```

## Usage

1. **Access Cockpit**: Open your Cockpit web interface (typically `https://your-server:9090`)

2. **Login**: Authenticate with a user that has ZFS permissions

3. **Open ZFS Manager**: Click on "ZFS Manager" in the Cockpit sidebar

4. **Manage ZFS**:
   - View all storage pools with health status and usage statistics
   - Expand pools to see file systems, snapshots, and detailed status
   - Create new pools, file systems, and snapshots
   - Manage encryption and unlock encrypted datasets
   - Clone and rollback snapshots
   - Export and destroy pools (with appropriate warnings)

## Features

### Storage Pool Management
- List all ZFS pools with health status
- View pool statistics (size, allocated, free, fragmentation, usage)
- Create new storage pools
- Import existing pools
- Export pools
- Destroy pools (with confirmation)

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

### Development Installation (Linux)
```bash
make devel-install
```

This creates a symlink at `~/.local/share/cockpit/zfs-manager` for local development.


## License

LGPL-2.1

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
