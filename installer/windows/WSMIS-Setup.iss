#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

#define AppName "WSMIS"
#define AppPublisher "Yaftom ICT Solution"
#define AppURL "https://wsmis.yaftom.com"
#define StageRoot "..\stage"

[Setup]
AppId={{8F9F1F1C-5BCF-4F76-92D0-7198EC71C4A9}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
DefaultDirName={autopf}\WSMIS
DefaultGroupName=WSMIS
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
OutputDir=..\dist
OutputBaseFilename=WSMIS-Setup-{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=110
CloseApplications=no
RestartApplications=no
SetupLogging=yes
UninstallDisplayName=WSMIS Local Application
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription=WSMIS Local Application Installer

[Files]
Source: "{#StageRoot}\program\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageRoot}\backend\*"; DestDir: "{commonappdata}\WSMIS\backend"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{commonappdata}\WSMIS"
Name: "{commonappdata}\WSMIS\backups"
Name: "{commonappdata}\WSMIS\logs"
Name: "{commonappdata}\WSMIS\mysql\data"

[InstallDelete]
Type: filesandordirs; Name: "{commonappdata}\WSMIS\backend\app"
Type: filesandordirs; Name: "{commonappdata}\WSMIS\backend\bootstrap"
Type: filesandordirs; Name: "{commonappdata}\WSMIS\backend\config"
Type: filesandordirs; Name: "{commonappdata}\WSMIS\backend\database"
Type: filesandordirs; Name: "{commonappdata}\WSMIS\backend\lang"
Type: filesandordirs; Name: "{commonappdata}\WSMIS\backend\resources"
Type: filesandordirs; Name: "{commonappdata}\WSMIS\backend\routes"
Type: filesandordirs; Name: "{commonappdata}\WSMIS\backend\vendor"
Type: files; Name: "{commonappdata}\WSMIS\backend\*.log"
Type: files; Name: "{commonappdata}\WSMIS\backend\check_*.php"
Type: files; Name: "{commonappdata}\WSMIS\backend\create_*.php"
Type: files; Name: "{commonappdata}\WSMIS\backend\test_*.php"
Type: files; Name: "{commonappdata}\WSMIS\backend\get_token.php"
Type: files; Name: "{commonappdata}\WSMIS\backend\.phpunit.result.cache"

[Icons]
Name: "{autodesktop}\WSMIS"; Filename: "http://127.0.0.1:3000"; Comment: "Open WSMIS"
Name: "{group}\Open WSMIS"; Filename: "http://127.0.0.1:3000"; Comment: "Open WSMIS"
Name: "{group}\WSMIS Data Folder"; Filename: "{commonappdata}\WSMIS"
Name: "{group}\Uninstall WSMIS"; Filename: "{uninstallexe}"

[Run]
Filename: "http://127.0.0.1:3000"; Description: "Open WSMIS"; Flags: shellexec postinstall skipifsilent nowait

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\Uninstall-WSMIS.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "StopAndBackupWSMIS"

[Code]
var
  PairingPage: TInputQueryWizardPage;

function ExistingInstall: Boolean;
begin
  Result := FileExists(ExpandConstant('{commonappdata}\WSMIS\install-state.json'));
end;

function JsonEscape(Value: String): String;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\"', True);
  StringChangeEx(Result, #13#10, '\n', True);
  StringChangeEx(Result, #10, '\n', True);
end;

procedure InitializeWizard;
begin
  PairingPage := CreateInputQueryPage(
    wpSelectDir,
    'Connect this computer to WSMIS',
    'Enter the one-time credentials created by an Admin.',
    'On the online website, open Settings, choose Local Computers, and click Add Computer. Paste the three values below.'
  );
  PairingPage.Add('Cloud API:', False);
  PairingPage.Add('Device ID:', False);
  PairingPage.Add('Device Secret:', True);
  PairingPage.Values[0] := 'https://wsmis-api.yaftom.com/api';
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := ExistingInstall and (PageID = PairingPage.ID);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = PairingPage.ID) and (not ExistingInstall) then
  begin
    if (Pos('http', Lowercase(Trim(PairingPage.Values[0]))) <> 1) then
    begin
      MsgBox('Enter the complete Cloud API address, beginning with https://.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if Length(Trim(PairingPage.Values[1])) <> 36 then
    begin
      MsgBox('The Device ID is not valid. Copy it again from Settings.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if Length(Trim(PairingPage.Values[2])) < 32 then
    begin
      MsgBox('The Device Secret is not valid. Create or rotate the computer credentials in Settings.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  StopScript: String;
begin
  Result := '';
  StopScript := ExpandConstant('{app}\scripts\Stop-WSMIS.ps1');
  if FileExists(StopScript) then
  begin
    Exec(
      ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoProfile -ExecutionPolicy Bypass -File "' + StopScript + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode
    );
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigPath: String;
  ConfigJson: String;
  CloudApi: String;
  DeviceId: String;
  DeviceSecret: String;
  ResultCode: Integer;
begin
  if CurStep <> ssPostInstall then
    Exit;

  WizardForm.StatusLabel.Caption := 'Installing required Windows components...';
  if not Exec(
    ExpandConstant('{app}\prerequisites\vc_redist.x64.exe'),
    '/install /quiet /norestart',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode
  ) or ((ResultCode <> 0) and (ResultCode <> 1638) and (ResultCode <> 3010)) then
  begin
    MsgBox(
      'The required Microsoft Visual C++ runtime could not be installed. Error code: ' + IntToStr(ResultCode),
      mbError, MB_OK
    );
    RaiseException('Microsoft runtime setup failed.');
  end;

  if ExistingInstall then
  begin
    CloudApi := '';
    DeviceId := '';
    DeviceSecret := '';
  end
  else
  begin
    CloudApi := Trim(PairingPage.Values[0]);
    DeviceId := Trim(PairingPage.Values[1]);
    DeviceSecret := Trim(PairingPage.Values[2]);
  end;

  ConfigPath := ExpandConstant('{tmp}\wsmis-setup.json');
  ConfigJson := '{' +
    '"version":"{#AppVersion}",' +
    '"cloud_api":"' + JsonEscape(CloudApi) + '",' +
    '"device_uuid":"' + JsonEscape(DeviceId) + '",' +
    '"device_secret":"' + JsonEscape(DeviceSecret) + '"' +
    '}';
  SaveStringToFile(ConfigPath, ConfigJson, False);

  WizardForm.StatusLabel.Caption := 'Configuring MySQL and downloading WSMIS data. This can take several minutes...';
  if not Exec(
    ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\Install-WSMIS.ps1') + '" -ConfigPath "' + ConfigPath + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode
  ) or (ResultCode <> 0) then
  begin
    MsgBox(
      'WSMIS could not be configured. No cloud data was marked ready.' + #13#10 + #13#10 +
      'Open ' + ExpandConstant('{commonappdata}\WSMIS\setup-error.txt') + ' for the exact reason, then run Setup again.',
      mbError, MB_OK
    );
    RaiseException('WSMIS setup failed.');
  end;
end;
