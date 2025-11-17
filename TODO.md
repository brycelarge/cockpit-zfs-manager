# ZFS Manager - Feature TODO List

## High Priority Features

### ZVOL (Block Volumes) Management
- [ ] Create ZVOL volumes (`zfs create -V`)
- [ ] List ZVOL volumes separately from file systems
- [ ] Display volume size and usage
- [ ] Delete ZVOL volumes
- [ ] Configure volume properties (volsize, volblocksize, etc.)
- [ ] Use cases: VMs, databases, block storage

### Dataset Rename
- [ ] Rename file systems (`zfs rename`)
- [ ] Rename ZVOL volumes
- [ ] Handle rename conflicts
- [ ] Update mount points after rename
- [ ] Note: Pool rename already exists

### Snapshot Holds/Release
- [ ] Add holds to snapshots (`zfs hold`)
- [ ] List holds on snapshots (`zfs holds`)
- [ ] Release holds (`zfs release`)
- [ ] Prevent deletion of held snapshots
- [ ] Display hold tags in snapshot list
- [ ] Use cases: Backup retention, preventing accidental deletion

## Medium Priority Features

### Snapshot Diff
- [ ] View changes between snapshots (`zfs diff`)
- [ ] Compare snapshot to current state
- [ ] Compare two snapshots
- [ ] Display file changes (added, modified, deleted)
- [ ] Filter by file path
- [ ] Use cases: Auditing, troubleshooting

### Bookmarks
- [ ] Create bookmarks (`zfs bookmark`)
- [ ] List bookmarks
- [ ] Delete bookmarks
- [ ] Use in replication (incremental send from bookmark)
- [ ] Use cases: Lightweight snapshot references, incremental replication

### Pool Upgrade
- [ ] Display current pool version (`zpool get version`)
- [ ] Show available upgrade versions
- [ ] Upgrade pool version (`zpool upgrade`)
- [ ] Upgrade all pools at once
- [ ] Warning about irreversible upgrades

### Replication Progress Tracking
- [ ] Show progress for `zfs send` operations
- [ ] Show progress for `zfs receive` operations
- [ ] Display transfer speed and ETA
- [ ] Cancel in-progress replication
- [ ] Resume interrupted replication

## Low Priority Features

### Pool Split
- [ ] Split mirrored pool (`zpool split`)
- [ ] Create new pool from split
- [ ] Handle split conflicts
- [ ] Use cases: Migration, backup

### Pool Attach
- [ ] Attach device to mirror (`zpool attach`)
- [ ] Alternative to disk replacement
- [ ] Convert single disk to mirror
- [ ] Show attach progress

### VDEV Removal
- [ ] Remove VDEV from pool (`zpool remove`)
- [ ] Check if removal is supported
- [ ] Handle removal limitations
- [ ] Warning about data loss risks
- [ ] Note: Limited support in ZFS (only top-level vdevs, must be offline)

### Cache/Log Devices
- [ ] Add L2ARC cache devices (`zpool add -c`)
- [ ] Add ZIL log devices (`zpool add -l`)
- [ ] Remove cache/log devices
- [ ] Display cache/log device status
- [ ] Show cache hit rates

### Snapshot List Filtering
- [ ] Filter by date range
- [ ] Filter by name pattern
- [ ] Filter by hold status
- [ ] Sort by date, size, name
- [ ] Search functionality

### Pool History
- [ ] View pool operation history (`zpool history`)
- [ ] Display command history with timestamps
- [ ] Filter by date range
- [ ] Export history log

### I/O Error Tracking
- [ ] Track I/O errors per device
- [ ] Display error counts in pool status
- [ ] Alert on high error rates
- [ ] Show error details per device
- [ ] Historical error tracking

## Completed Features ✓

- ✅ Pool management (create, delete, import, export)
- ✅ File system management (create, delete, properties)
- ✅ Snapshot management (create, delete, rollback, clone)
- ✅ Encryption support (unlock encrypted datasets)
- ✅ Replication (send/receive)
- ✅ Mount point management
- ✅ Performance statistics
- ✅ Share management (NFS/SMB)
- ✅ Sanoid integration
- ✅ Scrub scheduling
- ✅ SMART disk information
- ✅ Dashboard with ARC stats
- ✅ Usage visualization
- ✅ Pool expansion
- ✅ Disk replacement
- ✅ Properties management (pool and dataset)
- ✅ Pool rename
- ✅ Dataset tree view
- ✅ Compression and deduplication statistics

