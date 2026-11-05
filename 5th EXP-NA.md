#### **5th EXP-NA**



1. provide ip address to all the pc
2. switch commands-
3. enable
4. config t
5. vlan 10
6. name HR
7. vlan20
8. name it
9. interface fa0/1
10. switchport mode access
11. switchport access vlan 10
12. int fa0/2
13. switchport mode access
14. switchport access vlan 20





#### **6th EXP- Switch commands**

1. enable
2. config t
3. vlan 10
4. name HR
5. vlan 20
6. name IT
7. int fa0/1
8. switchport mode access
9. switchport access vlan 10
10. int fa0/2
11. switchport mode access
12. switchport access vlan 20
13. int fa0/3
14. switch mode trunk



### **Router commands**



1. int g0/0
2. no shutdown
3. interface g0/0.10
4. encapsulation dot1Q
5. ip address 10.0.0.2 255.0.0.0
6. encapsulation g0/0.20
7. ip address 20.0.0.2 255.0.0.0

