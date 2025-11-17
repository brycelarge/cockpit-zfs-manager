# Cockpit ZFS Manager

A modern Cockpit plugin for managing ZFS pools, datasets, and snapshots. Built with React and PatternFly 6, following the same architecture as `cockpit-machines`. Compatible with Cockpit 201+.

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

   This installs to `/usr/share/cockpit/zfs-manager` by default (Debian/Ubuntu).
   For other locations, use: `sudo make install PREFIX=/usr/local`

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
   - Expand pools to see file systems, snapshots, performance stats, and detailed status
   - Create new pools with various VDEV configurations (stripe, mirror, RAID-Z variants)
   - Expand pools by adding VDEVs
   - Replace failed disks
   - Configure pool and dataset properties
   - Create file systems and snapshots
   - Manage encryption and unlock encrypted datasets
   - Clone file systems and snapshots
   - Rollback to snapshots
   - Replicate snapshots (send/receive) for backups
   - Manage mount points and mount options
   - Configure NFS and SMB shares
   - Set up automated snapshots with Sanoid
   - Schedule ZFS scrubs for disk health
   - Export and destroy pools (with name confirmation)

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
- Destroy pools (with name confirmation)
- Expand pools by adding VDEVs
- Replace failed disks in pools
- Configure pool properties (comment, auto-replace, auto-trim, bootfs, cachefile, fail mode, readonly, delegation, listsnapshots)
- View detailed pool status with device information
- Performance statistics (I/O operations, throughput)

### File System Management
- List all file systems within pools
- Create new file systems
- Support for encrypted file systems with passphrase
- Clone file systems
- Destroy file systems (with name confirmation)
- Configure dataset properties:
  - General: compression, deduplication, atime, sync, recordsize, readonly, exec, setuid
  - Quota & Reservation: set storage limits and guarantees
  - Mount Options: configure mount points and mount behavior
- Manage mount points (mount/unmount, custom mount points, mount options)
- Configure NFS and SMB/CIFS shares

### Snapshot Management
- List all snapshots
- Create snapshots (pool-level or dataset-specific)
- Clone snapshots to new file systems
- Rollback to snapshots (with recursive option)
- Destroy snapshots (with name confirmation)
- Replicate snapshots (send/receive):
  - Send to local file or remote system via SSH
  - Receive from local file or remote system via SSH
  - Support for incremental and recursive replication
  - Include properties option

### Replication
- Send snapshots to backup locations
- Receive snapshots from remote systems
- Support for incremental replication
- SSH-based remote replication
- Dry-run mode for testing

### Mount Point Management
- View mount status
- Mount/unmount datasets
- Configure custom mount points
- Set mount options (noatime, nosuid, etc.)
- Overlay mount support

### Performance Statistics
- Real-time I/O statistics
- Read/write operations per second
- Throughput metrics
- Auto-refresh capability
- Pool-level performance monitoring

### Share Management
- Configure NFS shares with custom options
- Configure SMB/CIFS shares with custom names
- View current share configuration
- Enable/disable sharing per dataset

### Automation & Maintenance
- **Sanoid Integration**: Automated snapshot management
  - View Sanoid installation status
  - Edit Sanoid configuration
  - Validate configuration
  - View managed snapshots count
- **Scrub Scheduling**: Automated disk health checks
  - Manual scrub start/stop
  - Schedule weekly scrubs
  - Schedule monthly scrubs
  - Custom cron-based schedules
  - View scrub status and history

### Encryption Support
- Create encrypted file systems
- Unlock encrypted file systems with passphrase
- Visual indicators for encrypted datasets
- Bulk unlock for multiple encrypted datasets

### User Interface
- Modern PatternFly 6 design
- Expandable table rows for detailed views
- Tabbed interface (File Systems, Snapshots, Status, Performance, Sanoid, Scrub)
- Toast notifications for actions
- Responsive design
- Consistent with Cockpit's design language

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
