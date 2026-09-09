import React from 'react';
import { Pressable, Text, TextInput, TextInputProps, View } from 'react-native';
import { styles as s } from '../theme';
export function Botao({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[s.button,secondary&&s.secondary,disabled&&{opacity:0.55}]}><Text style={s.buttonText}>{title}</Text></Pressable>;
}
export function Campo({label,...props}:TextInputProps&{label:string}) {return <View style={{gap:8}}><Text style={s.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor="#576F65" style={[s.input,props.style]} /></View>;}
export function Aviso({texto}:{texto:string}) {return texto?<Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={s.error}>{texto}</Text>:null;}
