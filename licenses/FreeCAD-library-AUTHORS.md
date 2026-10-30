# FreeCAD-library 零件作者（v21）

来源：https://github.com/FreeCAD/FreeCAD-library （提交 f5ca01cdcaa2f69b9295a6382719c2d90628780c）

README 原文（许可证段）：

```
License
-------

All Parts in this repository are licensed under CC-BY 3.0 http://creativecommons.org/licenses/by/3.0/
Each Part is copyrighted by and should be attributed to its respective author(s).
See commit details to find the authors of each Part.

If you are uploading parts to this repository, please make sure you are the author of the model,
or otherwise that you have right to share it here under the CC-BY 3.0 license, and make sure the author
is mentioned in the commit message.
```

作者按 README 的要求从 git 提交记录追溯（含改名前路径）。改动：STEP → GLB 转换、网格减面、材质合并、单位换算、meshopt 压缩；型材长度变体只沿长度方向缩放。改编文件同样以 CC BY 3.0 发布。

| 零件 id | 原文件 | 作者 |
|---|---|---|
| fc-servo-sg90 | Electrical Parts/Servos/SG-90/Servo-sg90.step | Gafeju、WladIMirG |
| fc-servo-es08a | Electrical Parts/Servos/Emax-ES08A/Emax-es08A.step | obijuan、WladIMirG |
| fc-servo-futaba3003 | Electrical Parts/Servos/Futaba3003/Futaba3003.stp | obijuan、WladIMirG |
| fc-servo-sm-s4303r | Electrical Parts/Servos/SpringRC-SM-S4303R/SM-S4303R.step | obijuan、WladIMirG |
| fc-servo-sg90-horn1 | Electrical Parts/Servos/SG-90/SG90-1-arm-horn.step | Gafeju、WladIMirG |
| fc-servo-sg90-horn2 | Electrical Parts/Servos/SG-90/SG90-2-arms-horn.step | Gafeju、WladIMirG |
| fc-servo-sg90-horn4 | Electrical Parts/Servos/SG-90/SG90-4-arms-horn.step | Gafeju、WladIMirG |
| fc-servo-futaba-horn4 | Electrical Parts/Servos/Futaba3003/Futaba3003-4-arms-horn.step | obijuan、WladIMirG |
| fc-dc-tt-straight | Electrical Parts/Motors/DC motor/Yellow_gearmotor/straight/Yellow_gearmotor_straight.step | Charles Fox |
| fc-dc-tt-l | Electrical Parts/Motors/DC motor/Yellow_gearmotor/L_shape/Yellow_gearmotor_L.step | Charles Fox |
| fc-wheel-tt-65 | Electrical Parts/Motors/DC motor/Yellow_wheel_65mm/Yellow_wheel_65mm.step | Charles Fox |
| fc-dc-n20-pololu | Electrical Parts/Motors/DC motor/Pololu-Micro/Pololu-298_1-6V.step | Charles Fox |
| fc-dc-faulhaber-2342 | Electrical Parts/Motors/DC motor/FAULHABER 2342L-012CPR/FAULHABER_2342L-012CPR.step | Charles Fox |
| fc-dc-mabuchi-enc | Electrical Parts/Motors/DC motor/Mabuchi-Encoder/DCMotorEncoder.step | Charles Fox |
| fc-dc-mitsumi-12v | Electrical Parts/Motors/DC motor/Motors/Motor-CC-12V-MITSUMI.step | Charles Fox |
| fc-dc-wltoys-3v3 | Electrical Parts/Motors/DC motor/Motors/Motor-CC-3.3V-WlToy911.step | Charles Fox |
| fc-dc-6v-servo | Electrical Parts/Motors/DC motor/Motors/Motor-CC-6V-Servo.step | Charles Fox |
| fc-dc-cqrobot-37d | Electrical Parts/Motors/cqrobot_37d/CQRobot_37D_90to1_64CPR.step | Charles Fox |
| fc-step-28byj48 | Electrical Parts/Motors/Stepper/28BYJ-48/28BYJ-48.step | Charles Fox |
| fc-step-em286 | Electrical Parts/Motors/Stepper/EM-286/EM-286.step | Charles Fox |
| fc-nema17-conn | Electrical Parts/Motors/Stepper/NEMA/NEMA_17_with_connector.step | Charles Fox |
| fc-nema17-26 | Electrical Parts/Motors/Stepper/NEMA/Old/NEMA-17_Stepper_Motor_26mm_with_connector.stp | Charles Fox |
| fc-nema17-40 | Electrical Parts/Motors/Stepper/NEMA/Old/NEMA-17_Stepper_Motor_40mm.step | Charles Fox |
| fc-nema17-47 | Electrical Parts/Motors/Stepper/NEMA/Old/NEMA-17_Stepper_Motor_47mm.step | Charles Fox |
| fc-nema23-conn | Electrical Parts/Motors/Stepper/NEMA/NEMA_23_with_connector.step | Charles Fox |
| fc-nema17-bracket | Electrical Parts/Motors/Stepper/NEMA/Nema-17_Mount_Bracket/Nema-17_MountBracket.step | Charles Fox |
| fc-pump-mini | Electrical Parts/Motors/Vacuum Pump/Mini vacuum pump.step | Charles Fox |
| fc-fan-40 | Electrical Parts/fans/fan-40x40mm.step | obijuan、WladIMirG |
| fc-fan-50 | Electrical Parts/fans/fan-50x50mm.step | obijuan、WladIMirG |
| fc-blower-50 | Electrical Parts/fans/blower-50x50mm.step | obijuan、WladIMirG |
| fc-bearing-608zz | Mechanical Parts/Bearings/608ZZ_Ball_Bearing.step | Normand C、WladIMirG |
| fc-bearing-623zz | Mechanical Parts/Bearings/623ZZ_Ball_Bearing.step | rcccort、WladIMirG |
| fc-bearing-624zz | Mechanical Parts/Bearings/624ZZ_Ball_Bearing.stp | rcccort、WladIMirG |
| fc-bearing-f623zz | Mechanical Parts/Bearings/F623ZZ_Ball_Bearing.stp | diegotrap、WladIMirG |
| fc-bearing-6201 | Mechanical Parts/Bearings/Ball Bearings/6201-2RS_Ball_Bearing.step | WaalerThomas |
| fc-bearing-6803 | Mechanical Parts/Bearings/Ball Bearings/6803-2RS_Ball_Bearing.step | WaalerThomas |
| fc-lm8uu | Mechanical Parts/Bearings/linear_bearings/LM8uu.stp | obijuan、WladIMirG |
| fc-lm8suu | Mechanical Parts/Bearings/linear_bearings/LM8suu.step | obijuan、WladIMirG |
| fc-lm10uu | Mechanical Parts/Bearings/linear_bearings/LM10uu.step | Francisco、WladIMirG |
| fc-lm12uu | Mechanical Parts/Bearings/linear_bearings/LM12uu.step | Francisco、WladIMirG |
| fc-mgn7-rail | Mechanical Parts/Bearings/linear_bearings/LinearSlide-MGN7-Rail.step | Adrian McEwen |
| fc-mgn7c | Mechanical Parts/Bearings/linear_bearings/LinearSlide-MGN7C.step | Adrian McEwen |
| fc-mgn9-rail | Mechanical Parts/Bearings/linear_bearings/LinearSlide-MGN9-Rail.step | Adrian McEwen |
| fc-mgn9c | Mechanical Parts/Bearings/linear_bearings/LinearSlide-MGN9C.step | Adrian McEwen |
| fc-mgn9h | Mechanical Parts/Bearings/linear_bearings/LinearSlide-MGN9H.step | Adrian McEwen |
| fc-mgn12-rail | Mechanical Parts/Bearings/linear_bearings/LinearSlide-MGN12-Rail.step | Adrian McEwen |
| fc-mgn12c | Mechanical Parts/Bearings/linear_bearings/LinearSlide-MGN12C.step | Adrian McEwen |
| fc-mgn12h | Mechanical Parts/Bearings/linear_bearings/LinearSlide-MGN12H.step | Adrian McEwen |
| fc-sc8uu | Mechanical Parts/Mountings/SC8UU/SC8UU.step | hasecilu |
| fc-sk08 | Mechanical Parts/Mountings/SK08/SK08-SK08.step | hasecilu |
| fc-shf08 | Mechanical Parts/Mountings/SHF08/SHF08.step | hasecilu |
| fc-kfl08 | Mechanical Parts/Mountings/KFL08/KFL08.step | hasecilu |
| fc-kp08 | Mechanical Parts/Mountings/KP08/KP08.step | hasecilu |
| fc-t8-bracket | Mechanical Parts/Mountings/T8_housing_bracket/T8_housing_bracket.step | hasecilu |
| fc-t8-leadscrew-150 | Mechanical Parts/Mountings/T8_leadscrew/T8_leadscrew_150mm.step | hasecilu |
| fc-t8-flange-nut | Mechanical Parts/Mountings/T8_screw_nut/Flange_nut/T8_Flange_nut.step | hasecilu |
| fc-t8-antibacklash | Mechanical Parts/Mountings/T8_screw_nut/Anti_backlash_nut/T8_antibacklash_nut.step | hasecilu |
| fc-coupler-5x8 | Mechanical Parts/Fasteners/Shaft Couplers & Dowel Pins/Zaxis_coupling_5x8mm.step | Daniel Stauffer、WladIMirG |
| fc-ext-2020v-50 | Mechanical Parts/Mountings/2020_V-slot_Al_extrusion/2020x50_V_slot_profile-Part.step | hasecilu |
| fc-ext-2020b | Mechanical Parts/Profiles EN/Generic/Profile-20x20-B-Type_Slot6_A.step | mathis |
| fc-ext-2020i | Mechanical Parts/Profiles EN/Generic/Profile-20x20-I-Type_Slot5.step | mathis |
| fc-ext-2040b | Mechanical Parts/Profiles EN/Generic/Profile-20x40-B-Type_Slot6.step | mathis |
| fc-ext-3030b | Mechanical Parts/Profiles EN/Generic/Profile-30x30-B-Type_Slot8.step | mathis |
| fc-ext-3060b | Mechanical Parts/Profiles EN/Generic/Profile-30x60-B-Type_Slot8.step | mathis |
| fc-ext-4040i | Mechanical Parts/Profiles EN/Generic/Profile-40x40L-I-Type_Slot8.step | mathis |
| fc-ext-4080i | Mechanical Parts/Profiles EN/Generic/Profile-40x80L-I-Type_Slot8-Body.step | mathis |
| fc-corner-2020 | Mechanical Parts/Mountings/Corner/2020_corner_bracket-Corner.step | hasecilu |
| fc-joint-2020-90 | Mechanical Parts/Profiles EN/Generic/T-slot_20x20_90_joint.step | mathis |
| fc-gantry-2020 | Mechanical Parts/Mountings/Gantry_plate/Gantry_plate_20mm_v_slot.step | hasecilu |
| fc-plate-l5 | Mechanical Parts/Mountings/Joining_plate/L_shaped_5_holes-Plate.step | hasecilu |
| fc-plate-t5 | Mechanical Parts/Mountings/Joining_plate/T_shaped_5_holes-Plate.step | hasecilu |
| fc-tnut-2020-m3 | Mechanical Parts/Fasteners/T-nuts/TNut_2020_Slot6_Sliding_M3.step | Charles Fox |
| fc-tnut-2020-m4 | Mechanical Parts/Fasteners/T-nuts/TNut_2020_Slot6_Sliding_M4.step | Charles Fox |
| fc-tnut-2020-m5 | Mechanical Parts/Fasteners/T-nuts/TNut_2020_Slot6_Sliding_M5.step | Charles Fox |
| fc-gt2-20t-5 | Mechanical Parts/Pulleys/GT2_20T_Smooth_5mm_Bore.step | Márcio Pessoa、WladIMirG |
| fc-gt2-16t | Mechanical Parts/Pulleys/GT2_16T.step | Daniel Stauffer、WladIMirG |
| fc-gt2-pulley | Mechanical Parts/Pulleys/GT2Pulley.stp | rcccort、WladIMirG |
| fc-wheel-rc18 | Mechanical Parts/Wheels/Wheel-RC-1:8-17mm-hex/Wheel-RC-1:8-17mm-hex.step | Charles Fox |
| fc-hc-sr04 | Sensors/Ultrasonic Sensors/HC-SR04.step | Charles Fox |
| fc-maxsonar-mb1010 | Sensors/Ultrasonic Sensors/MaxSonar/MB1010/MaxSonar-MB1010.step | Charles Fox |
| fc-endstop | Electrical Parts/Endstop/endstop.stp | rcccort、WladIMirG |
| fc-microswitch-v | Electronics Parts/Switch/Limit switch/Microswitch_SPDT_Vertical.step | hasecilu |
| fc-l298n | Electrical Parts/Motor Drivers/L298N/L298N.step | Charles Fox |
