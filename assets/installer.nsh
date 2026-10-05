; Offer MD Hawk in Open With without changing extension defaults or UserChoice.
!macro HawkExtension EXT
  WriteRegNone HKCU "Software\Classes\.${EXT}\OpenWithProgids" "MDHawk.Markdown"
  WriteRegStr HKCU "Software\Classes\Applications\MD Hawk.exe\SupportedTypes" ".${EXT}" ""
  WriteRegStr HKCU "Software\MD Hawk\Capabilities\FileAssociations" ".${EXT}" "MDHawk.Markdown"
!macroend

!macro customInstall
  FileOpen $0 "$INSTDIR\installer-language.json" w
  FileWrite $0 '{$\"lcid$\":$LANGUAGE}'
  FileClose $0
  WriteRegStr HKCU "Software\Classes\MDHawk.Markdown" "" "Документ MD Hawk"
  WriteRegStr HKCU "Software\Classes\MDHawk.Markdown\DefaultIcon" "" '"$INSTDIR\MD Hawk.exe",0'
  WriteRegStr HKCU "Software\Classes\MDHawk.Markdown\shell\open\command" "" '"$INSTDIR\MD Hawk.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\Applications\MD Hawk.exe" "FriendlyAppName" "MD Hawk"
  WriteRegStr HKCU "Software\Classes\Applications\MD Hawk.exe\shell\open\command" "" '"$INSTDIR\MD Hawk.exe" "%1"'
  WriteRegStr HKCU "Software\MD Hawk\Capabilities" "ApplicationName" "MD Hawk"
  WriteRegStr HKCU "Software\MD Hawk\Capabilities" "ApplicationDescription" "Чтение Markdown, PDF и Word с историей и закладками"
  WriteRegStr HKCU "Software\RegisteredApplications" "MD Hawk" "Software\MD Hawk\Capabilities"
  !insertmacro HawkExtension md
  !insertmacro HawkExtension markdown
  !insertmacro HawkExtension mdown
  !insertmacro HawkExtension pdf
  !insertmacro HawkExtension docx
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  Delete "$INSTDIR\installer-language.json"
  DeleteRegValue HKCU "Software\Classes\.md\OpenWithProgids" "MDHawk.Markdown"
  DeleteRegValue HKCU "Software\Classes\.markdown\OpenWithProgids" "MDHawk.Markdown"
  DeleteRegValue HKCU "Software\Classes\.mdown\OpenWithProgids" "MDHawk.Markdown"
  DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "MDHawk.Markdown"
  DeleteRegValue HKCU "Software\Classes\.docx\OpenWithProgids" "MDHawk.Markdown"
  DeleteRegKey HKCU "Software\Classes\MDHawk.Markdown"
  DeleteRegKey HKCU "Software\Classes\Applications\MD Hawk.exe"
  DeleteRegKey HKCU "Software\MD Hawk\Capabilities"
  DeleteRegValue HKCU "Software\RegisteredApplications" "MD Hawk"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
