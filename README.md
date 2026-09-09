# Folder Catalog

## Moving catalog data to the user data folder

Packaged installs store the catalog in the Windows user data folder so later installer runs can update the app without wiping the library.

**Copy the data before you run a new installer.** The installer deletes the old program folder, including any `data` sitting next to the EXE.

### 1. Copy the current catalog somewhere safe

From File Explorer or PowerShell, copy the whole `data` folder. Use whichever source you actually have:

Installed app (typical):

`C:\Users\Jeremy\AppData\Local\Programs\Folder Catalog\data`

Development copy:

`C:\Users\Jeremy\Documents\Programming\FolderCategorizer\data`

Example:

```powershell
Copy-Item -Recurse "$env:LOCALAPPDATA\Programs\Folder Catalog\data" "$env:USERPROFILE\Desktop\FolderCatalog-data-backup"
```

### 2. Build and install the new version

```powershell
npm run build:win
```

Then run the new setup EXE.

### 3. Copy the backup into the user data folder

Quit Folder Catalog first, then:

```powershell
$dest = "$env:APPDATA\Folder Catalog\data"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Recurse -Force "$env:USERPROFILE\Desktop\FolderCatalog-data-backup\*" $dest
```

You should end up with:

- `%APPDATA%\Folder Catalog\data\index.sqlite`
- `%APPDATA%\Folder Catalog\data\folders\`

### 4. Open the app

Confirm your directories, applications, tags, and images are there.

If `%LOCALAPPDATA%\Programs\Folder Catalog` does not exist, look under `%LOCALAPPDATA%\Programs\folder-catalog` instead. The destination is always `%APPDATA%\Folder Catalog\data`.
