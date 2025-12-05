# ZFS Manager - Feature TODO List

## High Priority Features

### Replicate Filesystem
- [ ] Add "Replicate" option to filesystem actions
- [ ] Workflow to create fresh snapshot + replicate
- [ ] Simplify backup of entire datasets
- [ ] Reuse existing replication dialog

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



## Low Priority Features

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

## Busy Testing Features

### Snapshot Holds/Release ✅
- [x] Add holds to snapshots (`zfs hold`)
- [x] List holds on snapshots (`zfs holds`)
- [x] Release holds (`zfs release`)
- [x] Prevent deletion of held snapshots
- [x] Display hold tags in snapshot list
- [x] Use cases: Backup retention, preventing accidental deletion

### ZVOL (Block Volumes) Management ✅
- [x] Create ZVOL volumes (`zfs create -V`)
- [x] List ZVOL volumes separately from file systems
- [x] Display volume size and usage
- [x] Delete ZVOL volumes
- [x] Configure volume properties (volsize, volblocksize, etc.)
- [x] Use cases: VMs, databases, block storage

### Dataset Rename ✅
- [x] Rename file systems (`zfs rename`)
- [x] Rename ZVOL volumes
- [x] Handle rename conflicts
- [x] Update mount points after rename (automatic)
- [x] Note: Pool rename already exists

### Pool Upgrade ✅
- [x] Display current pool version (`zpool get version`)
- [x] Show available upgrade versions
- [x] Upgrade pool version (`zpool upgrade`)
- [x] Upgrade all pools at once
- [x] Warning about irreversible upgrades

### Replication Progress Tracking ✅
- [x] Show progress for `zfs send` operations
- [x] Show progress for `zfs receive` operations
- [x] Display transfer speed and ETA
- [x] Cancel in-progress replication
- [x] Pool-to-pool replication support
- [x] Select destination pool from known pools list

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

